import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = parseInt(process.env.PORT || '3333', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(async () => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url || '/', true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  // Initialize WebSocket server
  try {
    const { initializeWebSocket } = await import('./src/lib/websocket-server')
    const io = initializeWebSocket(httpServer)
    console.log('WebSocket server initialized')
  } catch (error) {
    console.warn('WebSocket server initialization failed:', (error as Error).message)
    console.log('Continuing without WebSocket support...')
  }

  httpServer
    .once('error', (err) => {
      console.error('Server error:', err)
      process.exit(1)
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`)
      console.log(`> WebSocket server initialized`)
    })

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nReceived SIGINT. Closing server gracefully...')
    httpServer.close(() => {
      console.log('Server closed.')
      process.exit(0)
    })
  })

  process.on('SIGTERM', () => {
    console.log('Received SIGTERM. Closing server gracefully...')
    httpServer.close(() => {
      console.log('Server closed.')
      process.exit(0)
    })
  })
})