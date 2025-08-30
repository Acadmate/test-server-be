import * as cheerio from 'cheerio'
import { decodeEncodedString, extractTextBetweenWords } from './common'
import { UserInfo, Advisor, InfoResponse } from '../types/types'

function parseUserTable($: cheerio.CheerioAPI): UserInfo {
    const items = $('div.cntdDiv > div > table:nth-child(1) tbody tr')
        .toArray()
        .flatMap((tr) =>
            $(tr)
                .find('td')
                .toArray()
                .map((td) => $(td).text().trim())
        )

    const map = new Map<string, string>()
    for (let i = 0; i < items.length; i += 2) {
        const key = items[i].replace(/:$/, '')
        const value = items[i + 1]
        map.set(key, value)
    }

    // Try to get batch from original "Batch" field first
    let batch = parseInt(map.get('Batch')!, 10) || 0
    
    // If batch is 0 or not found, try the new "Combo / Batch" format
    if (batch === 0) {
        // Look for the "Combo / Batch" row in the table to get the HTML structure
        const tableRows = $('div.cntdDiv > div > table:nth-child(1) tbody tr').toArray()
        
        for (const row of tableRows) {
            const $row = $(row)
            const cells = $row.find('td').toArray()
            
            if (cells.length >= 2) {
                const key = $(cells[0]).text().trim().replace(/:$/, '')
                
                if (key === 'Combo / Batch') {
                    const $valueCell = $(cells[1])
                    // Look for red-colored text (could be font color="red" or style with red color)
                    const redText = $valueCell.find('font[color="red"], [style*="color:red"], [style*="color:#red"], [style*="color: red"]').text().trim()
                    
                    if (redText) {
                        batch = parseInt(redText, 10) || 0
                    } else {
                        // Fallback: if no red color found, try to extract the number after slash
                        const comboBatch = $valueCell.text().trim()
                        const parts = comboBatch.split('/')
                        if (parts.length === 2) {
                            batch = parseInt(parts[1].trim(), 10) || 0
                        }
                    }
                    break
                }
            }
        }
    }

    return {
        registrationNumber: map.get('Registration Number')!,
        name: map.get('Name')!,
        batch: batch,
        mobile: parseInt(map.get('Mobile')!, 10) || 0,
        program: map.get('Program')!,
        department: map.get('Department')!,
        semester: parseInt(map.get('Semester')!, 10) || 0,
    }
}

function parseAdvisors($: cheerio.CheerioAPI): Advisor[] {
    const advisorTable = $('table')
        .filter((_, el) => $(el).text().includes('Faculty Advisor'))
        .last()

    if (!advisorTable.length) {
        throw new Error('Advisor table not found')
    }

    const advisors: Advisor[] = []

    advisorTable.find('td[align="center"]').each((_, td) => {
        const $td = $(td)
        const html = $td.find('strong').html()
        if (!html) return

        const [rawName, rawRole] = html.split(/<br\s*\/?>/i).map((s) =>
            s.replace(/<[^>]+>/g, '').trim()
        )

        if (!rawName || rawName === 'Counselor' || !rawRole) return

        const email = $td.find('font[color="blue"]').text().trim()
        const phone = $td.find('font[color="green"]').text().trim()

        advisors.push({
            name: rawName,
            role: rawRole,
            email,
            phone,
        })
    })

    return advisors
}

export async function fetchInfoData(cookies: string): Promise<InfoResponse> {
    const resp = await fetch(
        'https://academia.srmist.edu.in/srm_university/academia-academic-services/page/My_Time_Table_2023_24',
        {
            headers: {
                Accept: '*/*',
                Cookie: cookies,
                Host: 'academia.srmist.edu.in',
                Origin: 'https://academia.srmist.edu.in',
                Referer: 'https://academia.srmist.edu.in/',
            },
        }
    )

    if (!resp.ok) {
        throw new Error(`Fetch failed: ${resp.status} ${resp.statusText}`)
    }

    const raw = decodeEncodedString(await resp.text())
    const html = extractTextBetweenWords(
        raw,
        '</style>\n',
        "');function doaction(recType) { }</script>"
    )

    if (!html) {
        throw new Error('Failed to extract HTML payload')
    }

    const $ = cheerio.load(html)
    const user = parseUserTable($)
    const advisors = parseAdvisors($)

    return { user, advisors }
}
