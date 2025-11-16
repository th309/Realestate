import { NextRequest, NextResponse } from 'next/server'
import { importRedfinData, importRedfinDataFromFile, importAllRedfinData, discoverRedfinDatasets } from '@/lib/data-ingestion/sources/redfin'
import { importAllFromManifest, getManifestSummary, readRedfinManifest } from '@/lib/data-ingestion/sources/redfin-manifest'

export async function POST(request: NextRequest) {
  console.log('📥 POST /api/import-redfin - Request received')
  try {
    const contentType = request.headers.get('content-type') || ''
    console.log(`   Content-Type: ${contentType}`)
    
    // Check if this is a file upload (multipart/form-data)
    if (contentType.includes('multipart/form-data')) {
      console.log('   Processing file upload...')
      const formData = await request.formData()
      const file = formData.get('file') as File
      const metricName = (formData.get('metricName') as string) || ''
      const limitRows = formData.get('limitRows') ? parseInt(formData.get('limitRows') as string) : undefined

      if (!file) {
        console.error('❌ No file provided in request')
        return NextResponse.json(
          { success: false, message: 'No file provided' },
          { status: 400 }
        )
      }

      console.log(`   File received: ${file.name}, size: ${(file.size / 1024).toFixed(1)} KB`)
      console.log(`   Metric name: ${metricName || '(auto-detect)'}`)

      // Read file as ArrayBuffer to handle UTF-16 encoding properly
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      
      // Detect UTF-16 encoding by checking for BOM (Byte Order Mark)
      let csvContent: string
      if (uint8Array.length >= 2) {
        // Check for UTF-16 LE BOM (FF FE) or UTF-16 BE BOM (FE FF)
        if ((uint8Array[0] === 0xFF && uint8Array[1] === 0xFE) || 
            (uint8Array[0] === 0xFE && uint8Array[1] === 0xFF)) {
          // UTF-16 encoded - decode it properly
          const isLE = uint8Array[0] === 0xFF && uint8Array[1] === 0xFE
          csvContent = new TextDecoder(isLE ? 'utf-16le' : 'utf-16be').decode(uint8Array.slice(2))
          console.log('🔧 Detected UTF-16 encoding in uploaded file, decoded properly')
        } else {
          // Try UTF-8 first, fallback to text() if needed
          csvContent = new TextDecoder('utf-8').decode(uint8Array)
        }
      } else {
        // Fallback to text() for small files
        csvContent = await file.text()
      }
      
      console.log(`   CSV content length: ${csvContent.length} characters`)
      console.log('   Starting import...')
      
      // Create a readable stream for Server-Sent Events
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder()
          
          const sendProgress = (message: string, progress?: { current: number; total: number; percent: number }) => {
            const data = JSON.stringify({ type: 'progress', message, progress })
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          }
          
          try {
            const result = await importRedfinDataFromFile(csvContent, metricName, limitRows, sendProgress, file.name)
            console.log(`   Import complete: ${result.success ? '✅ Success' : '❌ Failed'}`)
            
            // Send final result with filename
            const finalData = JSON.stringify({ type: 'complete', result: { ...result, sourceFileName: file.name } })
            controller.enqueue(encoder.encode(`data: ${finalData}\n\n`))
            controller.close()
          } catch (error: any) {
            const errorData = JSON.stringify({ 
              type: 'error', 
              error: error.message || 'Unknown error' 
            })
            controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
            controller.close()
          }
        }
      })
      
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    } else {
      // JSON body with optional CSV content
      const body = await request.json()
      const { metricName, limitRows, csvContent } = body

      if (csvContent) {
        // Use provided CSV content
        const result = await importRedfinDataFromFile(csvContent, metricName, limitRows)
        return NextResponse.json(result)
      } else {
        // Try to download automatically using Puppeteer
        const result = await importRedfinData(metricName, limitRows)
        return NextResponse.json(result)
      }
    }
  } catch (error: any) {
    console.error('Error importing Redfin data:', error)
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to import Redfin data',
        error: error.message
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const action = searchParams.get('action')
    
    // Get manifest summary
    if (action === 'manifest-summary') {
      try {
        const summary = await getManifestSummary()
        return NextResponse.json({
          success: true,
          summary
        })
      } catch (error: any) {
        return NextResponse.json({
          success: false,
          error: error.message,
          message: 'Manifest not found. Please run scripts/redfin-discovery.py first to generate the manifest.'
        }, { status: 404 })
      }
    }

    // Import from manifest
    if (action === 'import-manifest') {
      const category = searchParams.get('category') || undefined
      const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined
      
      try {
        const results = await importAllFromManifest(undefined, {
          category,
          limit
        })
        return NextResponse.json({
          success: results.failed === 0,
          results
        })
      } catch (error: any) {
        return NextResponse.json({
          success: false,
          error: error.message
        }, { status: 500 })
      }
    }

    // Discover available datasets (legacy Puppeteer method)
    if (action === 'discover') {
      const datasets = await discoverRedfinDatasets()
      return NextResponse.json({
        success: true,
        datasets,
        count: datasets.length,
        message: datasets.length === 0 
          ? 'No datasets found. The page structure may have changed or require authentication. Try using the manifest-based import (run scripts/redfin-discovery.py first).'
          : `Found ${datasets.length} datasets`
      })
    }
    
    // Debug: Get page HTML structure
    if (action === 'debug') {
      const puppeteer = require('puppeteer')
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })
      
      try {
        const page = await browser.newPage()
        await page.goto('https://www.redfin.com/news/data-center/', { 
          waitUntil: 'networkidle2', 
          timeout: 60000 
        })
        await new Promise(resolve => setTimeout(resolve, 5000))
        
        const pageInfo = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a')).map(a => ({
            href: a.href,
            text: a.textContent?.trim(),
            className: a.className,
            id: a.id
          }))
          
          const buttons = Array.from(document.querySelectorAll('button, [role="button"]')).map(b => ({
            text: b.textContent?.trim(),
            className: b.className,
            id: b.id,
            ariaLabel: b.getAttribute('aria-label')
          }))
          
          return {
            title: document.title,
            totalLinks: links.length,
            totalButtons: buttons.length,
            sampleLinks: links.slice(0, 20),
            sampleButtons: buttons.slice(0, 20),
            bodyText: document.body.textContent?.substring(0, 1000)
          }
        })
        
        await browser.close()
        
        return NextResponse.json({
          success: true,
          pageInfo
        })
      } catch (error: any) {
        await browser.close()
        return NextResponse.json({
          success: false,
          error: error.message
        }, { status: 500 })
      }
    }
    
    // Import all datasets
    if (action === 'import-all') {
      const limitRows = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined
      const result = await importAllRedfinData(limitRows)
      return NextResponse.json(result)
    }
    
    // Import single dataset (default)
    const metricName = searchParams.get('metric') || 'median_sale_price'
    const limitRows = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined
    const downloadUrl = searchParams.get('url') || undefined

    const result = await importRedfinData(metricName, limitRows, undefined, downloadUrl)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error importing Redfin data:', error)
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to import Redfin data',
        error: error.message
      },
      { status: 500 }
    )
  }
}

