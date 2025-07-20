import fs from 'fs';
import path from 'path';

export function json2form(jsonFilename, boundary) {
    // 读取并解析JSON文件
    const jsonData = JSON.parse(fs.readFileSync(jsonFilename, 'utf8'));
    const formData = jsonData.form;

    const parts = [];
    const eol = '\r\n';

    for (const [name, value] of Object.entries(formData)) {
        // 开始边界
        let part = `--${boundary}${eol}`;

        if (typeof value === 'string') {
            // 简单文本字段
            part += `Content-Disposition: form-data; name="${name}"${eol}${eol}`;
            part += value;
            parts.push(Buffer.from(part, 'utf8'));
        }
        else if (value.value) {
            // 带元数据的文本字段
            const contentType = value['content-type']
            part += `Content-Disposition: form-data; name="${name}"${eol}`;
            if (contentType) {
                part += `Content-Type: ${contentType}${eol}`;

            }
            part += eol + value.value;
            parts.push(Buffer.from(part, 'utf8'));
        }
        else if (value.filename) {
            // 文件字段
            const filePath = path.resolve(path.dirname(jsonFilename), value.filename);
            const fileContent = fs.readFileSync(filePath);
            const contentType = value['content-type']

            part += `Content-Disposition: form-data; name="${name}"; filename="${path.basename(value.filename)}"${eol}`;
            part += `Content-Type: ${contentType}${eol}${eol}`;

            const headerBuffer = Buffer.from(part, 'utf8');
            parts.push(Buffer.concat([headerBuffer, fileContent]));
        }

        // 添加行尾
        parts.push(Buffer.from(eol, 'utf8'));
    }

    // 添加结束边界
    const footer = Buffer.from(`--${boundary}--${eol}`, 'utf8');
    parts.push(footer);

    return Buffer.concat(parts);
}

//Content-Type: multipart/form-data; boundary=----WebKitFormBoundary9iRV6DE66YMHGMpS
export function mkform(jsonFilename, boundary) {
    let bodyBoundary = boundary || '----WebKitFormBoundary{#header:0}'
    let buff = json2form(jsonFilename, bodyBoundary)
    let outputFile = convertFilePath(jsonFilename, 'form-data')
    console.log('## output:');
    console.log(`massping -b '${outputFile}' -H '${boundary || 'Content-Type: multipart/form-data; boundary=----WebKitFormBoundary{t16-16}'}' `);

    fs.writeFileSync(outputFile, buff)
}

export function convertFilePath(filePath, newExtension) {
    // 处理新扩展名格式（确保以点开头）
    let formattedExt = newExtension;
    if (newExtension) {
        if (typeof newExtension === 'string' && newExtension.length > 0) {
            formattedExt = newExtension.startsWith('.')
                ? newExtension
                : `.${newExtension}`;
        } else {
            formattedExt = ''; // 处理无效扩展名
        }
    } else {
        formattedExt = ''; // 处理 null/undefined
    }

    // 解析路径
    const parsed = path.parse(filePath);

    // 特殊情况处理：无文件名的纯目录路径（如 /a/b/）
    if (!parsed.base) {
        return filePath;
    }

    // 构建新文件名
    const newBase = parsed.name + formattedExt;

    // 使用 path.format 确保跨平台兼容性
    return path.format({
        root: parsed.root,
        dir: parsed.dir,
        base: newBase
    });
}
