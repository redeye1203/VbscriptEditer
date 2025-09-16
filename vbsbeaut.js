// VBScript beautifier

const fs = require('fs');
const path = require('path');

const VERSION = "1.11 (Node.js)";

// Embedded keywords
const KEYWORDS = [
    'Abs', 'And', 'Array', 'Asc', 'AtEndOfLine', 'AtEndOfStream', 'Atn',
    'Call', 'Case', 'CBool', 'CByte', 'CCur', 'CDate', 'CDbl', 'Chr',
    'CInt', 'Clear', 'CLng', 'Close', 'CompareMode', 'Const', 'Cos',
    'Count', 'CreateObject', 'CreateTextFile', 'CSng', 'CStr', 'Date',
    'DateAdd', 'DateDiff', 'DatePart', 'DateSerial', 'DateValue', 'Day',
    'Description', 'Dictionary', 'Dim', 'Do', 'Each', 'End', 'Else',
    'ElseIf', 'Empty', 'Eqv', 'Erase', 'Err', 'Error', 'Escape', 'Exists',
    'Exit', 'Exp', 'Explicit', 'False', 'FileSystemObject', 'Fix', 'For',
    'FormatCurrency', 'FormatDateTime', 'FormatNumber', 'FormatPercent',
    'Function', 'GetObject', 'Hex', 'HelpContext', 'HelpFile', 'Hour',
    'If', 'Imp', 'InputBox', 'InStr', 'InStrRev', 'Int', 'Is', 'IsArray',
    'IsDate', 'IsEmpty', 'IsNull', 'IsNumeric', 'IsObject', 'Item', 'Items',
    'Join', 'Keys', 'LBound', 'LCase', 'Left', 'Len', 'LoadPicture', 'Log',
    'Loop', 'LTrim', 'Mid', 'Minute', 'Mod', 'Month', 'MonthName', 'MsgBox',
    'Next', 'Not', 'Now', 'Nothing', 'Null', 'Number', 'Oct', 'On',
    'OpenTextFile', 'Option', 'Or', 'Private', 'Public', 'Raise',
    'Randomize', 'Read', 'ReadAll', 'ReadLine', 'ReDim', 'Rem', 'Remove',
    'RemoveAll', 'Replace', 'Request', 'Response', 'Right', 'Rnd', 'Round',
    'RTrim', 'ScriptEngine', 'ScriptEngineBuildVersion', 'ScriptEngineMajorVersion',
    'ScriptEngineMinorVersion', 'Second', 'Select', 'Server', 'Session',
    'Set', 'Sgn', 'Sin', 'Skip', 'SkipLine', 'Source', 'Space', 'Split',
    'Sqr', 'StrComp', 'String', 'StrReverse', 'Sub', 'Tan', 'Then', 'Time',
    'TextStream', 'TimeSerial', 'TimeValue', 'To', 'Trim', 'True', 'TypeName',
    'UBound', 'UCase', 'VarType', 'Weekday', 'WeekdayName', 'Wend', 'While',
    'With', 'Write', 'WriteBlankLines', 'WriteLine', 'Xor', 'Year'
];

// Embedded indent keywords
const INDENT_KEYWORDS = [
    { indent: 1, keyword: 'do while', singleline: false },
    { indent: 1, keyword: 'do until', singleline: false },
    { indent: 1, keyword: 'if', singleline: false },
    { indent: 1, keyword: 'for', singleline: false },
    { indent: 1, keyword: 'function', singleline: false },
    { indent: 1, keyword: 'sub', singleline: false },
    { indent: 1, keyword: 'with', singleline: false },
    { indent: -1, keyword: 'end if', singleline: false },
    { indent: -1, keyword: 'end function', singleline: false },
    { indent: -1, keyword: 'end sub', singleline: false },
    { indent: -1, keyword: 'end with', singleline: false },
    { indent: -1, keyword: 'next', singleline: false },
    { indent: -1, keyword: 'loop', singleline: false },
    { indent: 2, keyword: 'select case', singleline: false },
    { indent: -2, keyword: 'end select', singleline: false },
    { indent: -1, keyword: 'case else', singleline: true },
    { indent: -1, keyword: 'elseif', singleline: true },
    { indent: -1, keyword: 'else', singleline: true },
    { indent: -1, keyword: 'case', singleline: true },
    { indent: 0, keyword: 'exit for', singleline: false },
    { indent: 0, keyword: 'exit function', singleline: false },
    { indent: 0, keyword: 'exit sub', singleline: false }
];

class VBSBeautifier {
    constructor(options = {}) {
        this.options = {
            useSpaces: options.spaces || false,
            spaceCount: options.spaceCount || 4,
            uppercase: options.uppercase || false,
            lowercase: options.lowercase || false,
            noKeywordChange: options.noKeywordChange || false,
            noDimSplit: options.noDimSplit || false,
            useStdin: options.useStdin || false
        };
    }

    header() {
        return `------------------------------------------
VBScript Beautifier v${VERSION}
(C)2001-2009 By Niek Albers - DaanSystems
------------------------------------------`;
    }

    beautifyFile(filename) {
        try {
            const text = fs.readFileSync(filename, 'utf8');
            const beautified = this.doAll(text);
            fs.writeFileSync(`${filename}.bak`, text);
            fs.writeFileSync(filename, beautified);
            console.error(`- Beautified: ${filename}`);
        } catch (error) {
            console.error(`ERROR: Can't process ${filename}: ${error.message}`);
        }
    }

    doAll(input) {
        let inputLines = input.split('\n');

        console.error("- Searching clientside VBScript delimiters.");
        this.replaceClientVBScriptTags(inputLines);
        input = inputLines.join('\n');

        console.error("- Searching serverside VBScript delimiters.");
        const html = this.getHtml(input);
        input = html.text;

        console.error("- Searching comments in clientside VBScript.");
        const clientComments = this.getClientComments(input);
        input = clientComments.text;

        inputLines = input.split('\n');

        console.error("- Searching quoted text.");
        const quoted = this.getQuoted(inputLines);

        console.error("- Searching VBScript comments.");
        const comments = this.getComments(inputLines);

        input = inputLines.join('\n');

        // 處理 On Error Resume Next
        const onErrorResult = this.getOnErrorResumeNext(input);
        input = onErrorResult.text || input;

        inputLines = input.split('\n');

        if (!this.options.noDimSplit) {
            console.error("- Splitting Dim statements.");
            this.preprocess2(inputLines);
        }

        input = inputLines.join('\n');
        inputLines = input.split('\n');

        console.error("- Adjusting spaces around operators.");
        this.fixSpaces(inputLines);

        if (!this.options.noKeywordChange) {
            console.error("- Modifying keywords.");
            this.replaceKeywords(inputLines);
        }

        console.error("- Processing indent.");
        this.processIndent(inputLines);

        console.error("- Lining out assignment statements.");
        this.lineoutEqualSigns(inputLines);

        console.error("- Lining out comments.");
        this.lineoutComments(inputLines, quoted.lineQuotes);

        input = inputLines.join('\n');

        // 還原 On Error Resume Next
        const putOnErrorResult = this.putOnErrorResumeNext(input);
        input = putOnErrorResult.text || input;

        console.error("- Removing redundant newlines.");
        const removeEntersResult = this.removeRedundantEnters(input);
        input = removeEntersResult.text || input;

        const functionCommentsResult = this.putFunctionCommentsToDeclaration(input);
        input = functionCommentsResult.text || input;

        const putCommentsResult = this.putComments(input, comments.comments);
        input = putCommentsResult.text || input;

        const putQuotedResult = this.putQuoted(input, quoted.quoted);
        input = putQuotedResult.text || input;

        const putClientCommentsResult = this.putClientComments(input, clientComments.comments);
        input = putClientCommentsResult.text || input;

        const putHtmlResult = this.putHtml(input, html.html);
        input = putHtmlResult.text || input;

        input = input.replace(/^\n\n+/, '\n');

        const replaceTagsResult = this.replaceClientVBScriptTagsBack(input);
        input = replaceTagsResult.text || input;

        console.error("- All Done!");
        console.error("------------------------------------------");
        return input;
    }

    replaceClientVBScriptTags(lines) {
        let found = false;
        for (let i = 0; i < lines.length; i++) {
            if (!found) {
                const match = lines[i].match(/(<\s*script.*?vbscript.*?>)/i);
                if (match && !lines[i].match(/".*?<\s*script.*?vbscript.*?>.*?"/i)) {
                    lines[i] = lines[i].replace(/(<\s*script.*?vbscript.*?>)/i, '$1 %[clientscript]%<%');
                    found = true;
                }
            } else {
                const match = lines[i].match(/(<\/\s*script\s*>)/i);
                if (match && !lines[i].match(/".*?<\/\s*script\s*>.*?"/i)) {
                    lines[i] = lines[i].replace(/(<\/\s*script\s*>)/i, '%>%[clientscript]% $1');
                    found = false;
                }
            }
        }
    }

    replaceClientVBScriptTagsBack(input) {
        const result = { text: input };
        result.text = result.text.replace(/%>%\[clientscript\]%/g, '\n');
        result.text = result.text.replace(/%\[clientscript\]%<%/g, '\n');
        return result;
    }

    getHtml(input) {
        // 只有當輸入包含 ASP 標籤時才處理
        if (!input.includes('<%') && !input.includes('%>')) {
            return { text: input, html: [] };
        }

        const startHtml = input.match(/^(.*?<%)/s);
        let text = input;

        if (startHtml) {
            text = text.replace(/^(.*?<%)/, '%[html]%');
        }

        const endHtml = input.match(/.*(%>.*)$/s);
        if (endHtml) {
            text = text.replace(/(.*)(%>.*)$/, '$1%[html]%');
        }

        const htmlMatches = text.match(/(%>.*?<%)/gs) || [];
        text = text.replace(/(%>.*?<%)/gs, '%[html]%');

        const html = [];
        if (startHtml) html.push(startHtml[1]);
        html.push(...htmlMatches);
        if (endHtml) html.push(endHtml[2]);

        return { text, html };
    }

    putHtml(input, html) {
        const result = { text: input };

        // 如果沒有 html 需要還原，直接返回
        if (!html || html.length === 0) {
            return result;
        }

        let counter = 0;
        result.text = result.text.replace(/%\[html\]%/g, () => html[counter++] || '');
        result.text = result.text.replace(/(\S+)\s*%>/g, '$1 %>');
        result.text = result.text.replace(/<%\n/g, '%[extraenter]%');
        result.text = result.text.replace(/<%\s*(\S+)/g, '<% $1');
        result.text = result.text.replace(/%\[extraenter\]%/g, '<%\n');
        return result;
    }

    getClientComments(input) {
        const comments = input.match(/(<!--|-->)/g) || [];
        const text = input.replace(/(<!--|-->)/g, '%[clientcomments]%');
        if (comments.length % 2 !== 0) {
            throw new Error("ERROR: Clientside comments not balanced!");
        }
        return { text, comments };
    }

    putClientComments(input, comments) {
        const result = { text: input };
        let counter = 0;
        result.text = result.text.replace(/%\[clientcomments\]%/g, () => comments[counter++] || '');
        return result;
    }

    /**
     * @description 從 VBScript 程式碼行陣列中擷取所有註解。
     * 此函數會處理 VBScript 的單引號 (') 註解語法，並透過追蹤雙引號 (") 狀態來忽略字串中的單引號。
     * 它會將找到的註解從原始行中移除，並替換為一個占位符 '%[comment]%'。
     * @param {string[]} lines - 包含 VBScript 程式碼的字串陣列，此陣列會被直接修改。
     * @returns {{comments: string[]}} 包含所有擷取到的註解內容的物件。
     */
    getComments(lines) {
        const allComments = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            let inDoubleQuote = false;
            let commentStartIndex = -1;

            // 逐字元掃描以尋找不在字串中的註解開頭符號 (')
            for (let j = 0; j < line.length; j++) {
                const char = line[j];
                if (char === '"') {
                    inDoubleQuote = !inDoubleQuote;
                } else if (char === "'" && !inDoubleQuote) {
                    commentStartIndex = j;
                    break; // 找到註解開頭，跳出內層迴圈
                }
            }

            if (commentStartIndex !== -1) {
                // 如果找到了註解
                // 1. 擷取從註解符號開始到行尾的所有內容
                const comment = line.substring(commentStartIndex);
                allComments.push(comment);

                // 2. 在原始行中，用占位符取代註解
                lines[i] = line.substring(0, commentStartIndex) + '%[comment]%';
            }
        }
        return { comments: allComments };
    }

    putComments(input, comments) {
        const result = { text: input };
        let counter = 0;
        result.text = result.text.replace(/%\[comment\]%/g, (match, offset, string) => {
            const comment = comments[counter++] || '';
            // 檢查註解前是否有非空白字符（即不是全行註解）
            const beforeComment = string.substring(0, offset);
            const currentLine = beforeComment.split('\n').pop();
            const hasCodeBefore = currentLine.trim().length > 0;

            // 如果前面有程式碼且註解不是以空格開頭，則加一個空格
            if (comment && hasCodeBefore && !comment.startsWith(' ') && !comment.startsWith('\t')) {
                return ' ' + comment;
            }
            return comment;
        });
        return result;
    }

    getQuoted(lines) {
        const allQuoted = [];
        const lineQuotes = {}; // map from line number to array of quotes on that line
        for (let i = 0; i < lines.length; i++) {
            const quotedMatches = lines[i].match(/(".*?")/g) || [];
            if (quotedMatches.length > 0) {
                allQuoted.push(...quotedMatches);
                lineQuotes[i] = quotedMatches;
                lines[i] = lines[i].replace(/(".*?")/g, '%[quoted]%');
            }
        }
        return { quoted: allQuoted, lineQuotes };
    }

    putQuoted(input, quoted) {
        const result = { text: input };
        let counter = 0;
        result.text = result.text.replace(/%\[quoted\]%/g, () => quoted[counter++] || '');
        return result;
    }

    preprocess2(lines) {
        for (let i = 0; i < lines.length; i++) {
            if (/\bdim\b/i.test(lines[i])) {
                lines[i] = lines[i].replace(/,\s*/g, '\ndim ');
            }
        }
    }

    fixSpaces(lines) {
        for (let i = 0; i < lines.length; i++) {
            // 檢查是否為純註解行
            const trimmed = lines[i].trim();
            const isPureComment = trimmed === '%[comment]%';

            if (isPureComment) {
                // 純註解行清除所有前導空格
                lines[i] = trimmed;
            } else {
                // 普通行清理前後空格
                lines[i] = lines[i].replace(/^\s*(.*?)\s*$/, '$1');
            }

            // 處理操作符周圍的空格（避免影響註解占位符）
            if (!isPureComment) {
                lines[i] = lines[i].replace(/\s*(=|<|>|-|\+|&)\s*/g, ' $1 ');
                lines[i] = lines[i].replace(/\s*<\s*>\s*/g, ' <> ');
                lines[i] = lines[i].replace(/\s*<\s*=\s*/g, ' <= ');
                lines[i] = lines[i].replace(/\s*=\s*<\s*/g, ' =< ');
                lines[i] = lines[i].replace(/\s*>\s*=\s*/g, ' >= ');
                lines[i] = lines[i].replace(/\s*=\s*>\s*/g, ' => ');
                lines[i] = lines[i].replace(/\s*!\s*=\s*/g, ' != ');
                lines[i] = lines[i].replace(/\s*<\s*%\s*/g, '<% ');
                lines[i] = lines[i].replace(/\s*%\s*>/g, ' %>');
                lines[i] = lines[i].replace(/\s*_\s*$/, ' _');
            }
        }
    }

    wordCount(text) {
        return (text.match(/\w+/g) || []).length;
    }

    getKeywordsIndent() {
        const keywords = [];
        const singlelineKeywords = [];
        const indents = {};

        INDENT_KEYWORDS.forEach(item => {
            indents[item.keyword] = item.indent;
            if (!item.singleline) {
                keywords.push(item.keyword);
            } else {
                singlelineKeywords.push(item.keyword);
            }
        });

        const keywordsSorted = keywords.sort((a, b) => this.wordCount(b) - this.wordCount(a));
        const singlelineKeywordsSorted = singlelineKeywords.sort((a, b) => this.wordCount(b) - this.wordCount(a));

        return { keywords: keywordsSorted, singlelineKeywords: singlelineKeywordsSorted, indents };
    }

    countDelta(line, keywords, indents) {
        let delta = 0;
        let lineCopy = line;
        keywords.forEach(keyword => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
            if (regex.test(lineCopy)) {
                delta += indents[keyword];
                lineCopy = lineCopy.replace(regex, '');
            }
        });
        return delta;
    }

    singlelineIfThen(line) {
        return line.replace(/if.*?then\s+[^%]/gi, '');
    }

    /**
     * @description Process indent for each line of code. This version correctly indents full-line comments.
     * @param {string[]} lines - The array of code lines.
     */
    processIndent(lines) {
        const spaces = this.options.useSpaces ? ' '.repeat(this.options.spaceCount) : '\t';
        let tabTotal = 0;
        const { keywords, singlelineKeywords, indents } = this.getKeywordsIndent();

        for (let i = 0; i < lines.length; i++) {
            let delta = 0;
            let singleDelta = 0;
            const oldDelta = delta;

            // 判斷是否為純註解行（即整行除了註解占位符外沒有其他內容）
            const isPureComment = lines[i].trim().replace(/%\[comment\]%/g, '').trim() === '';

            // 只對包含實際程式碼的行計算縮排層級的變化
            if (!isPureComment) {
                let lineCopy = this.singlelineIfThen(lines[i]);
                delta += this.countDelta(lineCopy, keywords, indents);
                singleDelta -= this.countDelta(lineCopy, singlelineKeywords, indents);
            }

            // 處理減縮排的關鍵字（如 End If），它們會影響當前行的縮排
            tabTotal += (delta < 0) ? delta : 0;
            const indentLevel = Math.max(0, tabTotal);

            // 處理加縮排的關鍵字（如 If），它們會影響下一行的縮排
            tabTotal += (delta > 0) ? delta : 0;

            // 將計算好的縮排應用到所有行（包括純註解行）
            // 先 trim() 是為了移除該行原有的所有空白，再應用新的、正確的縮排
            const trimmedLine = lines[i].trim();
            lines[i] = spaces.repeat(Math.max(0, indentLevel - singleDelta)) + trimmedLine;


            // 保留原始的在區塊前後增加空行的邏輯
            if (delta > oldDelta) {
                lines[i] = '\n' + lines[i];
            }
            if (delta < oldDelta) {
                lines[i] = lines[i] + '\n';
            }
        }
    }

    replaceKeywords(lines) {
        for (let i = 0; i < lines.length; i++) {
            KEYWORDS.forEach(keyword => {
                let modifiedKeyword = keyword;
                if (this.options.uppercase) {
                    modifiedKeyword = keyword.toUpperCase();
                } else if (this.options.lowercase) {
                    modifiedKeyword = keyword.toLowerCase();
                }
                const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
                lines[i] = lines[i].replace(regex, modifiedKeyword);
            });
        }
    }

    removeRedundantEnters(input) {
        const result = { text: input };
        result.text = result.text.replace(/\n\s*\n+/g, '\n\n');
        return result;
    }

    isAssignment(line) {
        return /^\s*(set)?\s*\S+\s*=.*$/i.test(line);
    }

    getLineNumbersWithStatements(lines) {
        const statementLineNumbers = [];
        for (let i = 0; i < lines.length; i++) {
            if (this.isAssignment(lines[i])) {
                statementLineNumbers.push(i);
            }
        }
        return statementLineNumbers;
    }

    getMaxEqualPosFromLines(lines, lineNumbers) {
        const equalPositions = lineNumbers.map(lineNum => lines[lineNum].indexOf('='));
        return Math.max(...equalPositions);
    }

    lineout(lines, lineNumbers) {
        const lastEqualPos = this.getMaxEqualPosFromLines(lines, lineNumbers);
        lineNumbers.forEach(lineNumber => {
            const equalSign = lines[lineNumber].indexOf('=');
            const diff = equalSign - lastEqualPos;
            if (diff < 0) {
                lines[lineNumber] = lines[lineNumber].replace('=', ' '.repeat(Math.abs(diff)) + '=');
            }
        });
    }

    lineoutEqualSigns(lines) {
        const statementLineNumbers = this.getLineNumbersWithStatements(lines);
        if (statementLineNumbers.length < 2) return;

        let lastLineNumber = -1;
        let block = [];

        const processBlock = (currentBlock) => {
            if (currentBlock.length >= 2) {
                this.lineout(lines, [...new Set(currentBlock)]);
            }
        };

        statementLineNumbers.forEach(lineNumber => {
            let isConsecutive = false;
            if (block.length > 0) {
                if (lineNumber === lastLineNumber + 1) {
                    // Adjacent lines are always consecutive.
                    isConsecutive = true;
                } else if (lineNumber === lastLineNumber + 2) {
                    // Gap of 1 line. Check what's in the gap.
                    const lineInGap = lines[lastLineNumber + 1].trim();
                    // It's consecutive if the line in the gap is empty or a full-line comment.
                    if (lineInGap === '' || lineInGap === '%[comment]%') {
                        isConsecutive = true;
                    }
                }
            }

            if (isConsecutive) {
                block.push(lineNumber);
            } else {
                processBlock(block);
                block = [lineNumber];
            }
            lastLineNumber = lineNumber;
        });

        // Process the very last block after the loop finishes.
        processBlock(block);
    }

    isTrailingComment(line) {
        const trimmed = line.trim();
        // A line has a trailing comment if it contains the placeholder but is not a pure comment line.
        return trimmed.includes('%[comment]%') && trimmed !== '%[comment]%';
    }

    getLineNumbersWithTrailingComments(lines) {
        const lineNumbers = [];
        for (let i = 0; i < lines.length; i++) {
            if (this.isTrailingComment(lines[i])) {
                lineNumbers.push(i);
            }
        }
        return lineNumbers;
    }

    getMaxCodeLengthFromLines(lines, lineNumbers, lineQuotes) {
        const lengths = lineNumbers.map(lineNum => {
            const line = lines[lineNum];
            const commentIndex = line.indexOf('%[comment]%');
            const lineCode = line.substring(0, commentIndex);

            let realLength = lineCode.length;

            const quotesOnThisLine = lineQuotes[lineNum];
            if (quotesOnThisLine) {
                const placeholderCount = (lineCode.match(/%\[quoted\]%/g) || []).length;
                if (placeholderCount > 0) {
                    // subtract all placeholder lengths
                    realLength -= placeholderCount * 10; // '%%[quoted]%%'.length
                    // add all real quote lengths
                    quotesOnThisLine.forEach(quote => {
                        realLength += quote.length;
                    });
                }
            }

            const trailingSpace = lineCode.length - lineCode.trimEnd().length;
            return realLength - trailingSpace;
        });
        return Math.max(...lengths);
    }

    lineoutCommentBlock(lines, lineNumbers, lineQuotes) {
        const maxCodeLength = this.getMaxCodeLengthFromLines(lines, lineNumbers, lineQuotes);
        lineNumbers.forEach(lineNumber => {
            const line = lines[lineNumber];
            const commentIndex = line.indexOf('%[comment]%');
            const codePart = line.substring(0, commentIndex);
            const commentPart = line.substring(commentIndex);

            const trimmedCodePart = codePart.trimEnd();

            // We need to calculate the "real" length of the current line's code part as well
            let currentRealLength = trimmedCodePart.length;
            const quotesOnThisLine = lineQuotes[lineNumber];
            if (quotesOnThisLine) {
                const placeholderCount = (trimmedCodePart.match(/%\[quoted\]%/g) || []).length;
                if (placeholderCount > 0) {
                    currentRealLength -= placeholderCount * 10;
                    quotesOnThisLine.forEach(quote => {
                        currentRealLength += quote.length;
                    });
                }
            }

            const spacesNeeded = maxCodeLength - currentRealLength;

            let finalCodePart = trimmedCodePart;
            if (spacesNeeded > 0) {
                finalCodePart += ' '.repeat(spacesNeeded);
            }

            lines[lineNumber] = finalCodePart + commentPart;
        });
    }

    lineoutComments(lines, lineQuotes) {
        const lineNumbers = this.getLineNumbersWithTrailingComments(lines);
        if (lineNumbers.length < 2) return;

        let lastLineNumber = -1;
        let block = [];

        const processBlock = (currentBlock) => {
            if (currentBlock.length >= 2) {
                this.lineoutCommentBlock(lines, [...new Set(currentBlock)], lineQuotes);
            }
        };

        lineNumbers.forEach(lineNumber => {
            let isConsecutive = false;
            if (block.length > 0) {
                if (lineNumber === lastLineNumber + 1) {
                    isConsecutive = true;
                } else if (lineNumber === lastLineNumber + 2) {
                    const lineInGap = lines[lastLineNumber + 1].trim();
                    // It's consecutive if the line in the gap is empty or a full-line comment.
                    if (lineInGap === '' || lineInGap === '%[comment]%') {
                        isConsecutive = true;
                    }
                }
            }

            if (isConsecutive) {
                block.push(lineNumber);
            } else {
                processBlock(block);
                block = [lineNumber];
            }
            lastLineNumber = lineNumber;
        });

        // Process the very last block after the loop finishes.
        processBlock(block);
    }

    getOnErrorResumeNext(input) {
        const result = { text: input };
        result.text = result.text.replace(/on\s+error\s+resume\s+next/gis, '%[resumenext]%');
        return result;
    }

    putOnErrorResumeNext(input) {
        const result = { text: input };
        result.text = result.text.replace(/%\[resumenext\]%/gis, 'On Error Resume Next');
        return result;
    }

    putFunctionCommentsToDeclaration(input) {
        const result = { text: input };
        result.text = result.text.replace(/%\[comment\]%\n\nFunction/gis, '%[comment]%\nFunction');
        result.text = result.text.replace(/%\[comment\]%\n\nSub/gis, '%[comment]%\nSub');
        return result;
    }
}

function showUsage() {
    console.error(`------------------------------------------
VBScript Beautifier v${VERSION}
(C)2001-2009 By Niek Albers - DaanSystems
------------------------------------------

Homepage: http://www.daansystems.com
Comments/Bugs: nieka@daansystems.com
------------------------------------------
Usage: node vbsbeaut.js [options] [files]

options:
 -i         Use standard input (as text filter).
 -s <val>   Uses spaces instead of tabs.
 -u         Make keywords uppercase.
 -l         Make keywords lowercase.
 -n         Don't change keywords.
 -d         Don't split Dim statements.

files:
 filenames  File names to beautify.
------------------------------------------`);
}

function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        showUsage();
        process.exit(0);
    }

    const options = {
        useStdin: false,
        useSpaces: false,
        spaceCount: 4,
        uppercase: false,
        lowercase: false,
        noKeywordChange: false,
        noDimSplit: false
    };

    const files = [];

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '-i') {
            options.useStdin = true;
        } else if (arg === '-s') {
            options.useSpaces = true;
            if (i + 1 < args.length && !isNaN(parseInt(args[i + 1]))) {
                options.spaceCount = parseInt(args[++i]);
            }
        } else if (arg === '-u') {
            options.uppercase = true;
        } else if (arg === '-l') {
            options.lowercase = true;
        } else if (arg === '-n') {
            options.noKeywordChange = true;
        } else if (arg === '-d') {
            options.noDimSplit = true;
        } else if (!arg.startsWith('-')) {
            files.push(arg);
        }
    }

    console.error(`------------------------------------------
VBScript Beautifier v${VERSION}
(C)2001-2009 By Niek Albers - DaanSystems
------------------------------------------`);

    const beautifier = new VBSBeautifier(options);

    if (options.useStdin) {
        let input = '';
        process.stdin.on('data', chunk => {
            input += chunk;
        });
        process.stdin.on('end', () => {
            console.log(beautifier.doAll(input));
        });
    } else {
        files.forEach(filename => {
            try {
                if (fs.statSync(filename).isFile()) {
                    beautifier.beautifyFile(filename);
                }
            } catch (error) {
                console.error(`ERROR: Cannot access ${filename}: ${error.message}`);
            }
        });
    }
}

if (require.main === module) {
    main();
}

module.exports = VBSBeautifier;