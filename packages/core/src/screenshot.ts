import puppeteer, { type Browser } from 'puppeteer'
import { put } from '@vercel/blob'
import { nanoid } from 'nanoid'

export interface ScreenshotOptions {
  owner: string
  repo: string
  commitSha: string
  blobToken: string
}

export interface ScreenshotResult {
  id: string
  commitSha: string
  url: string
  createdAt: Date
}

let browserInstance: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    })
  }
  return browserInstance
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close()
    browserInstance = null
  }
}

/**
 * Takes a screenshot of a GitHub repository at a specific commit
 */
export async function takeCommitScreenshot(
  options: ScreenshotOptions
): Promise<ScreenshotResult> {
  const { owner, repo, commitSha, blobToken } = options

  const browser = await getBrowser()
  const page = await browser.newPage()

  try {
    // Set viewport for consistent screenshots
    await page.setViewport({ width: 1280, height: 800 })

    // Navigate to the commit tree view on GitHub
    const url = `https://github.com/${owner}/${repo}/tree/${commitSha}`
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

    // Wait for the repository content to load
    await page.waitForSelector('[data-testid="repos-split-pane-content"]', {
      timeout: 10000,
    }).catch(() => {
      // Fallback: wait for any main content
      return page.waitForSelector('main', { timeout: 5000 })
    })

    // Small delay for any animations to complete
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Take screenshot
    const screenshotBuffer = await page.screenshot({
      type: 'png',
      fullPage: false,
    })

    // Upload to Vercel Blob
    const id = nanoid()
    const filename = `${owner}/${repo}/${commitSha.substring(0, 7)}.png`

    // Convert Uint8Array to Buffer for Vercel Blob compatibility
    const buffer = Buffer.from(screenshotBuffer)

    const blob = await put(filename, buffer, {
      access: 'public',
      token: blobToken,
      contentType: 'image/png',
    })

    return {
      id,
      commitSha,
      url: blob.url,
      createdAt: new Date(),
    }
  } finally {
    await page.close()
  }
}

/**
 * Takes screenshots for multiple commits
 */
export async function takeMultipleScreenshots(
  owner: string,
  repo: string,
  commitShas: string[],
  blobToken: string,
  onProgress?: (current: number, total: number, result: ScreenshotResult) => void
): Promise<ScreenshotResult[]> {
  const results: ScreenshotResult[] = []

  for (let i = 0; i < commitShas.length; i++) {
    const sha = commitShas[i]
    const result = await takeCommitScreenshot({
      owner,
      repo,
      commitSha: sha,
      blobToken,
    })
    results.push(result)
    onProgress?.(i + 1, commitShas.length, result)
  }

  return results
}
