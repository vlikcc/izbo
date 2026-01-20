import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import type { QuestionType, CreateQuestionRequest } from '../types';

export interface ParsedQuestion {
    content: string;
    type: QuestionType;
    options: string[];
    correctAnswer: string;
    points: number;
    explanation?: string;
}

export interface ImportResult {
    success: boolean;
    questions: ParsedQuestion[];
    errors: string[];
    warnings: string[];
}

/**
 * Excel dosyasından soruları parse eder
 * 
 * Beklenen sütun formatı:
 * | Soru | Tip | A | B | C | D | E | Doğru Cevap | Puan | Açıklama |
 * 
 * Tip değerleri: "Çoktan Seçmeli", "Doğru/Yanlış", "Kısa Cevap"
 */
export async function parseExcelFile(file: File): Promise<ImportResult> {
    const result: ImportResult = {
        success: false,
        questions: [],
        errors: [],
        warnings: [],
    };

    try {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });

        // İlk sheet'i al
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
            result.errors.push('Excel dosyasında hiç sheet bulunamadı.');
            return result;
        }

        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: ''
        }) as unknown as unknown[][];

        if (jsonData.length < 2) {
            result.errors.push('Excel dosyasında yeterli veri yok. En az başlık satırı ve bir soru satırı gerekli.');
            return result;
        }

        // Başlık satırını al ve sütun indexlerini bul
        const headers = (jsonData[0] as string[]).map(h => String(h).toLowerCase().trim());

        const columnMap = detectColumnMapping(headers);

        if (!columnMap.question) {
            result.errors.push('Soru sütunu bulunamadı. "Soru", "Question" veya "Soru Metni" sütunu gerekli.');
            return result;
        }

        // Veri satırlarını işle
        for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as unknown[];
            const rowNum = i + 1;

            try {
                const question = parseExcelRow(row, columnMap, rowNum);
                if (question) {
                    result.questions.push(question);
                }
            } catch (error) {
                result.warnings.push(`Satır ${rowNum}: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
            }
        }

        result.success = result.questions.length > 0;

        if (result.questions.length === 0) {
            result.errors.push('Hiçbir soru parse edilemedi.');
        }

    } catch (error) {
        result.errors.push(`Dosya okuma hatası: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
    }

    return result;
}

interface ColumnMapping {
    question?: number;
    type?: number;
    optionA?: number;
    optionB?: number;
    optionC?: number;
    optionD?: number;
    optionE?: number;
    correctAnswer?: number;
    points?: number;
    explanation?: number;
}

function detectColumnMapping(headers: string[]): ColumnMapping {
    const map: ColumnMapping = {};

    headers.forEach((header, index) => {
        const h = header.toLowerCase();

        if (h.includes('soru') || h === 'question' || h === 'content') {
            map.question = index;
        } else if (h === 'tip' || h === 'type' || h === 'tür') {
            map.type = index;
        } else if (h === 'a' || h === 'seçenek a' || h === 'option a') {
            map.optionA = index;
        } else if (h === 'b' || h === 'seçenek b' || h === 'option b') {
            map.optionB = index;
        } else if (h === 'c' || h === 'seçenek c' || h === 'option c') {
            map.optionC = index;
        } else if (h === 'd' || h === 'seçenek d' || h === 'option d') {
            map.optionD = index;
        } else if (h === 'e' || h === 'seçenek e' || h === 'option e') {
            map.optionE = index;
        } else if (h.includes('doğru') || h.includes('cevap') || h === 'answer' || h === 'correct') {
            map.correctAnswer = index;
        } else if (h === 'puan' || h === 'points' || h === 'score') {
            map.points = index;
        } else if (h.includes('açıklama') || h === 'explanation') {
            map.explanation = index;
        }
    });

    return map;
}

function parseExcelRow(row: unknown[], columnMap: ColumnMapping, _rowNum: number): ParsedQuestion | null {
    const getValue = (index: number | undefined): string => {
        if (index === undefined) return '';
        const val = row[index];
        return val !== undefined && val !== null ? String(val).trim() : '';
    };

    const content = getValue(columnMap.question);
    if (!content) {
        return null; // Boş satırı atla
    }

    // Tip belirleme
    const typeStr = getValue(columnMap.type).toLowerCase();
    let type: QuestionType = 'MultipleChoice';

    if (typeStr.includes('doğru') || typeStr.includes('yanlış') || typeStr === 'truefalse' || typeStr === 'd/y') {
        type = 'TrueFalse';
    } else if (typeStr.includes('kısa') || typeStr === 'shortanswer' || typeStr === 'açık uçlu') {
        type = 'ShortAnswer';
    }

    // Seçenekleri topla
    const options: string[] = [];
    if (type === 'TrueFalse') {
        options.push('Doğru', 'Yanlış');
    } else if (type === 'MultipleChoice') {
        const optA = getValue(columnMap.optionA);
        const optB = getValue(columnMap.optionB);
        const optC = getValue(columnMap.optionC);
        const optD = getValue(columnMap.optionD);
        const optE = getValue(columnMap.optionE);

        if (optA) options.push(optA);
        if (optB) options.push(optB);
        if (optC) options.push(optC);
        if (optD) options.push(optD);
        if (optE) options.push(optE);
    }

    // Doğru cevap
    let correctAnswer = getValue(columnMap.correctAnswer);
    if (type === 'TrueFalse') {
        if (correctAnswer.toLowerCase() === 'd' || correctAnswer.toLowerCase() === 'doğru' || correctAnswer === 'true') {
            correctAnswer = 'Doğru';
        } else if (correctAnswer.toLowerCase() === 'y' || correctAnswer.toLowerCase() === 'yanlış' || correctAnswer === 'false') {
            correctAnswer = 'Yanlış';
        }
    }

    // Puan
    const pointsStr = getValue(columnMap.points);
    const points = parseInt(pointsStr) || 10;

    // Açıklama
    const explanation = getValue(columnMap.explanation) || undefined;

    return {
        content,
        type,
        options,
        correctAnswer,
        points,
        explanation,
    };
}

/**
 * Word dosyasından soruları parse eder
 * 
 * Beklenen format:
 * Her soru numaralandırılmış (1., 2., vb.) veya "Soru X:" şeklinde
 * Seçenekler A), B), C), D) şeklinde
 * Doğru cevap: A/B/C/D veya [Doğru: X] formatında
 */
export async function parseWordFile(file: File): Promise<ImportResult> {
    const result: ImportResult = {
        success: false,
        questions: [],
        errors: [],
        warnings: [],
    };

    try {
        const arrayBuffer = await file.arrayBuffer();
        const mammothResult = await mammoth.extractRawText({ arrayBuffer });
        const text = mammothResult.value;

        if (!text.trim()) {
            result.errors.push('Word dosyasında metin bulunamadı.');
            return result;
        }

        // Soruları ayır
        const questionBlocks = splitIntoQuestions(text);

        for (let i = 0; i < questionBlocks.length; i++) {
            try {
                const question = parseWordQuestion(questionBlocks[i]);
                if (question) {
                    result.questions.push(question);
                }
            } catch (error) {
                result.warnings.push(`Soru ${i + 1}: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
            }
        }

        result.success = result.questions.length > 0;

        if (result.questions.length === 0) {
            result.errors.push('Hiçbir soru parse edilemedi. Lütfen formatı kontrol edin.');
        }

    } catch (error) {
        result.errors.push(`Dosya okuma hatası: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
    }

    return result;
}

function splitIntoQuestions(text: string): string[] {
    // Soru numarası veya "Soru X:" formatına göre ayır
    const pattern = /(?:^|\n)(?:\d+[.)]\s*|Soru\s*\d*\s*[:.]\s*)/gi;
    const parts = text.split(pattern).filter(p => p.trim());
    return parts;
}

function parseWordQuestion(block: string): ParsedQuestion | null {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l);

    if (lines.length === 0) return null;

    // İlk satır soru metni
    let content = lines[0];
    const options: string[] = [];
    let correctAnswer = '';
    let type: QuestionType = 'ShortAnswer';

    // Seçenekleri bul
    const optionPattern = /^([A-E])[.)]\s*(.+)$/i;
    const correctPattern = /(?:doğru\s*cevap|correct|cevap)\s*[:.]\s*([A-E])/i;

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];

        const optionMatch = line.match(optionPattern);
        if (optionMatch) {
            options.push(optionMatch[2].trim());
            type = 'MultipleChoice';
            continue;
        }

        const correctMatch = line.match(correctPattern);
        if (correctMatch) {
            correctAnswer = correctMatch[1].toUpperCase();
            continue;
        }

        // Doğru/Yanlış kontrolü
        if (line.toLowerCase().includes('doğru') && line.toLowerCase().includes('yanlış')) {
            type = 'TrueFalse';
            options.push('Doğru', 'Yanlış');
        }
    }

    // Eğer seçenek varsa tip'i güncelle
    if (options.length >= 2 && type !== 'TrueFalse') {
        type = 'MultipleChoice';
    }

    return {
        content,
        type,
        options,
        correctAnswer,
        points: 10,
    };
}

/**
 * Parsed sorularını CreateQuestionRequest formatına dönüştürür
 */
export function convertToCreateRequests(
    questions: ParsedQuestion[],
    startIndex: number = 1
): CreateQuestionRequest[] {
    return questions.map((q, i) => ({
        orderIndex: startIndex + i,
        type: q.type,
        content: q.content,
        options: q.options.length > 0 ? q.options : undefined,
        correctAnswer: q.correctAnswer || undefined,
        points: q.points,
        explanation: q.explanation,
    }));
}

/**
 * Dosya tipine göre uygun parser'ı çağırır
 */
export async function parseQuestionFile(file: File): Promise<ImportResult> {
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        return parseExcelFile(file);
    } else if (fileName.endsWith('.docx')) {
        return parseWordFile(file);
    } else {
        return {
            success: false,
            questions: [],
            errors: [`Desteklenmeyen dosya formatı: ${file.name}. Desteklenen formatlar: .xlsx, .xls, .docx`],
            warnings: [],
        };
    }
}
