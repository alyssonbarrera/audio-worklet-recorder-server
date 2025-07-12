/** biome-ignore-all lint/suspicious/noConsole: console */
import type { Socket } from 'socket.io'
import WebSocket from 'ws'
import type {
  ConversationItemInputAudioTranscriptionCompleted,
  ConversationItemInputAudioTranscriptionDelta,
  ResponseAudioDelta,
  ResponseAudioDone,
  ResponseAudioTranscriptDelta,
  ResponseAudioTranscriptDone,
  ResponseTextDelta,
} from './types.ts'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_REALTIME_URL =
  'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17'

export class OpenAISessionHandler {
  socket: Socket
  responseText = ''
  openaiWS: WebSocket | null
  responseAudioChunks: string[] = []
  transcriptionCompleted = false
  pendingResponseDeltas: string[] = []

  constructor(socket: Socket) {
    this.socket = socket
    this.openaiWS = null
    this.responseAudioChunks = []
    this.responseText = ''
  }

  startSession() {
    console.log('Iniciando sessão com OpenAI...')

    this.openaiWS = new WebSocket(OPENAI_REALTIME_URL, {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1',
      },
    })

    this.setupWebSocketHandlers()
  }

  setupWebSocketHandlers() {
    if (!this.openaiWS) {
      return
    }

    this.openaiWS.on('open', () => this.handleConnectionOpen())
    this.openaiWS.on('message', (data) => this.handleMessage(data))
    this.openaiWS.on('close', () => this.handleConnectionClose())
    this.openaiWS.on('error', (error) => this.handleConnectionError(error))
  }

  handleConnectionOpen() {
    console.log('Conexão com OpenAI estabelecida')

    const sessionConfig = this.createSessionConfig()
    this.openaiWS?.send(JSON.stringify(sessionConfig))
  }

  createSessionConfig() {
    return {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions:
          'Você é um assistente útil. Responda sempre em português, de forma clara, amigável e objetiva. Nunca responda em outro idioma, mesmo que solicitado.',
        voice: 'alloy',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1',
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
          create_response: true,
        },
        temperature: 0.8,
        max_response_output_tokens: 'inf',
        speed: 1.1,
        tracing: 'auto',
      },
    }
  }

  handleMessage(data: WebSocket.RawData) {
    const messageString = data.toString()
    const message = JSON.parse(messageString)

    const eventHandlers = {
      'session.updated': () => this.handleSessionUpdated(),
      'conversation.item.input_audio_transcription.delta': () =>
        this.handleTranscriptionDelta(message),
      'conversation.item.input_audio_transcription.completed': () =>
        this.handleTranscriptionCompleted(message),
      'response.audio_transcript.delta': () =>
        this.handleResponseTranscriptDelta(message),
      'response.audio_transcript.done': () =>
        this.handleResponseTranscriptDone(message),
      'response.text.delta': () => this.handleResponseTextDelta(message),
      'response.content_part.done': () => this.handleResponseTextDone(),
      'response.audio.delta': () => this.handleResponseAudioDelta(message),
      'response.audio.done': () => this.handleResponseAudioDone(message),
      'response.done': () => this.handleResponseDone(),
      'session.ended': () => this.handleConnectionClose(),
      error: () => this.handleError(message),
    } as const

    const handler = eventHandlers[message.type as keyof typeof eventHandlers]

    if (handler) {
      handler()
    }
  }

  handleSessionUpdated() {
    console.log('Sessão OpenAI atualizada - pronta para receber áudio')
    this.socket.emit('backend_ready', {
      message: 'Backend pronto para receber áudio',
    })
  }

  handleTranscriptionDelta(data: ConversationItemInputAudioTranscriptionDelta) {
    console.log('Transcrição parcial:', data)
  }

  handleTranscriptionCompleted(
    data: ConversationItemInputAudioTranscriptionCompleted
  ) {
    this.socket.emit('transcription_final', data.transcript)
  }

  handleResponseTranscriptDelta(data: ResponseAudioTranscriptDelta) {
    console.log('Transcrição da resposta (parcial):', data)
    this.socket.emit('response_transcript_partial', data)
  }

  handleResponseTranscriptDone(data: ResponseAudioTranscriptDone) {
    this.socket.emit('response_transcript_final', data.transcript)
  }

  handleResponseTextDelta(data: ResponseTextDelta) {
    if (data) {
      console.log('Texto da resposta (parcial):', data.delta)

      // Se a transcrição ainda não foi completada, armazena em buffer
      if (!this.transcriptionCompleted) {
        this.pendingResponseDeltas.push(data.delta)
        return
      }

      // Se a transcrição foi completada, processa normalmente
      this.responseText += data.delta
      this.socket.emit('response_text_delta', data.delta)
    }
  }

  handleResponseTextDone() {
    if (this.responseText) {
      this.socket.emit('response_text_final', this.responseText)
    }
  }

  processPendingResponseDeltas() {
    // Processa todos os deltas que estavam em buffer
    for (const delta of this.pendingResponseDeltas) {
      this.responseText += delta
      this.socket.emit('response_text_delta', delta)
    }
    // Limpa o buffer
    this.pendingResponseDeltas = []
  }

  handleResponseAudioDelta(data: ResponseAudioDelta) {
    if (data) {
      this.responseAudioChunks.push(data.delta)
      this.socket.emit('response_audio_delta', data.delta)
    }
  }

  handleResponseAudioDone(_data: ResponseAudioDone) {
    if (this.responseAudioChunks.length > 0) {
      this.socket.emit('response_audio', this.responseAudioChunks)
      this.responseAudioChunks = []
    }
  }

  handleResponseDone() {
    console.log('Resposta finalizada')
    this.responseText = ''
    // Reset das flags para próxima conversa
    this.transcriptionCompleted = false
    this.pendingResponseDeltas = []
  }

  handleError(message: unknown) {
    console.error('Erro da OpenAI:', message)
    this.socket.emit('openai_error', message)
  }

  handleConnectionClose() {
    console.log('Conexão com OpenAI encerrada')
    this.socket.disconnect(true)
  }

  handleConnectionError(error: Error) {
    console.error('Erro na conexão com OpenAI:', error)
  }

  handleAudioChunk(audioData: string) {
    if (this.isWebSocketReady()) {
      this.openaiWS?.send(
        JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: audioData,
        })
      )
    }
  }

  stopAudio() {
    if (this.isWebSocketReady()) {
      this.openaiWS?.send(
        JSON.stringify({
          type: 'input_audio_buffer.commit',
        })
      )
    }
  }

  isWebSocketReady() {
    return this.openaiWS && this.openaiWS.readyState === WebSocket.OPEN
  }

  cleanup() {
    console.log('Cliente desconectado')
    if (this.openaiWS) {
      this.openaiWS.close()
    }
  }
}
