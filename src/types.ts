export type ResponseAudioDelta = {
  event_id: string
  type: 'response.audio.delta'
  response_id: string
  item_id: string
  output_index: number
  content_index: number
  delta: string // Base64 encoded audio chunk
}

export type ResponseAudioDone = {
  event_id: string
  type: 'response.audio.done'
  response_id: string
  item_id: string
  output_index: number
  content_index: number
}

export type ConversationItemInputAudioTranscriptionDelta = {
  event_id: string
  type: 'conversation.item.input_audio_transcription.delta'
  item_id: string
  content_index: number
  delta: string // Partial transcription delta
}

export type ConversationItemInputAudioTranscriptionCompleted = {
  event_id: string
  type: 'conversation.item.input_audio_transcription.completed'
  item_id: string
  content_index: number
  transcript: string
  usage: {
    type: 'tokens'
    total_tokens: number
    input_tokens: number
    input_token_details: {
      text_tokens: number
      audio_tokens: number
    }
    output_tokens: number
  }
}

export type ResponseContentPartAdded = {
  event_id: string
  type: 'response.content_part.added'
  response_id: string
  item_id: string
  output_index: number
  content_index: number
  part: {
    type: 'text'
    text: string
  }
}

export type ResponseTextDelta = {
  event_id: string
  type: 'response.text.delta'
  response_id: string
  item_id: string
  output_index: number
  content_index: number
  delta: string // Partial text delta
}

export type ResponseAudioTranscriptDelta = {
  event_id: string
  type: 'response.audio_transcript.delta'
  response_id: string
  item_id: string
  output_index: number
  content_index: number
  delta: string // Partial audio transcript delta
}

export type ResponseAudioTranscriptDone = {
  event_id: string
  type: 'response.audio_transcript.done'
  response_id: string
  item_id: string
  output_index: number
  content_index: number
  transcript: string // Final audio transcript
}
