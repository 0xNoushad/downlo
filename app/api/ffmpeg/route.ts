import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function GET() {
  try {
    await execAsync('ffmpeg -version')
    return Response.json({ 
      available: true,
      message: 'ffmpeg is installed and available'
    })
  } catch (error) {
    return Response.json({ 
      available: false,
      message: 'ffmpeg is not installed or not in PATH'
    })
  }
}