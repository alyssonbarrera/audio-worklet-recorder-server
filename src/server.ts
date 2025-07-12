/** biome-ignore-all lint/suspicious/noConsole: console.log */
import { fastifyCors } from '@fastify/cors'
import { type FastifyInstance, fastify } from 'fastify'
import { Server } from 'socket.io'
import { OpenAISessionHandler } from './open-ai-session-handler.ts'

class AudioStreamingServer {
  app: FastifyInstance
  io: Server

  constructor() {
    this.app = fastify()
    this.io = new Server(this.app.server, {
      cors: {
        origin: 'http://localhost:5173',
      },
    })

    this.setupMiddleware()
    this.setupSocketHandlers()
  }

  setupMiddleware() {
    this.app.register(fastifyCors, {
      origin: 'http://localhost:5173',
    })
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log('Cliente conectado')

      const sessionHandler = new OpenAISessionHandler(socket)

      socket.on('start', () => sessionHandler.startSession())
      socket.on('audio_chunk', (audioData) =>
        sessionHandler.handleAudioChunk(audioData)
      )
      socket.on('stop', () => sessionHandler.stopAudio())
      socket.on('disconnect', () => sessionHandler.cleanup())
    })
  }

  start(port = 3000) {
    this.app.listen({
      port,
    })
  }
}

// Inicia o servidor
const server = new AudioStreamingServer()
server.start()
