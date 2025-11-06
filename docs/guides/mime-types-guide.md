---
GUIDE USAGE: When needing to determine a formal MIME type for file extensions.
---

# @title MIME Types Reference Guide
# @description Comprehensive reference for MIME types and their associated file extensions
# @category guides
# @created 2025-06-20T17:52:33+10:00
# @last_modified 2025-06-20T17:52:33+10:00

## Overview

MIME (Multipurpose Internet Mail Extensions) types are a standard way of classifying file types on the Internet. They help web servers and browsers determine how to process different types of content.

### Default MIME Types
- `text/plain`: Default for textual files (must be human-readable)
- `application/octet-stream`: Default for unknown/binary files

## Common MIME Types

### Text Formats
| Extension | MIME Type | Description |
|-----------|-------------------------------|-------------|
| .txt | text/plain | Plain text |
| .html, .htm | text/html | HTML documents |
| .css | text/css | CSS stylesheets |
| .csv | text/csv | Comma-separated values |
| .ics | text/calendar | iCalendar format |
| .js, .mjs | text/javascript | JavaScript files |
| .ts | text/typescript | TypeScript files |
| .xml | text/xml | XML documents |

### Image Formats
| Extension | MIME Type | Description |
|-----------|-----------------|-------------|
| .bmp | image/bmp | Bitmap images |
| .gif | image/gif | GIF images |
| .ico | image/vnd.microsoft.icon | Icon files |
| .jpeg, .jpg | image/jpeg | JPEG images |
| .png | image/png | PNG images |
| .svg | image/svg+xml | Vector images |
| .tif, .tiff | image/tiff | TIFF images |
| .webp | image/webp | WebP images |

### Audio/Video Formats
| Extension | MIME Type | Description |
|-----------|---------------------|-------------|
| .aac | audio/aac | AAC audio |
| .mid, .midi | audio/midi | MIDI audio |
| .mp3 | audio/mpeg | MP3 audio |
| .oga | audio/ogg | OGG audio |
| .opus | audio/opus | Opus audio |
| .wav | audio/wav | WAV audio |
| .weba | audio/webm | WebM audio |
| .mp4 | video/mp4 | MP4 video |
| .mpeg | video/mpeg | MPEG video |
| .ogv | video/ogg | OGG video |
| .ts | video/mp2t | MPEG transport stream |
| .webm | video/webm | WebM video |
| .3gp | video/3gpp | 3GPP video/audio |
| .3g2 | video/3gpp2 | 3GPP2 video/audio |

### Application Formats
| Extension | MIME Type | Description |
|-----------|----------------------------------|-------------|
| .bin | application/octet-stream | Binary data |
| .doc | application/msword | Word documents |
| .docx | application/vnd.openxmlformats... | Word (OpenXML) |
| .eot | application/vnd.ms-fontobject | Embedded OpenType |
| .epub | application/epub+zip | EPUB ebooks |
| .gz | application/gzip | GZip archive |
| .jar | application/java-archive | Java archive |
| .json | application/json | JSON data |
| .jsonld | application/ld+json | JSON-LD data |
| .odp | application/vnd.oasis.opendoc... | OpenDocument presentation |
| .ods | application/vnd.oasis.opendoc... | OpenDocument spreadsheet |
| .odt | application/vnd.oasis.opendoc... | OpenDocument text |
| .ogx | application/ogg | OGG container |
| .pdf | application/pdf | PDF documents |
| .ppt | application/vnd.ms-powerpoint | PowerPoint |
| .pptx | application/vnd.openxmlformats... | PowerPoint (OpenXML) |
| .rar | application/vnd.rar | RAR archive |
| .rtf | application/rtf | Rich Text Format |
| .sh | application/x-sh | Shell script |
| .tar | application/x-tar | TAR archive |
| .xls | application/vnd.ms-excel | Excel |
| .xlsx | application/vnd.openxmlformats... | Excel (OpenXML) |
| .xul | application/vnd.mozilla.xul+xml | XUL |
| .zip | application/zip | ZIP archive |
| .7z | application/x-7z-compressed | 7-Zip archive |

### Font Formats
| Extension | MIME Type | Description |
|-----------|------------|-------------|
| .otf | font/otf | OpenType font |
| .ttf | font/ttf | TrueType font |
| .woff | font/woff | Web Open Font Format |
| .woff2 | font/woff2 | Web Open Font Format 2 |

## Usage in Web Development

### Setting MIME Types in HTML
```html
<!-- Link to a CSS file -->
<link rel="stylesheet" href="styles.css" type="text/css">

<!-- Embed an image -->
<img src="image.jpg" alt="Description" type="image/jpeg">

<!-- Link to a PDF -->
<a href="document.pdf" type="application/pdf">View PDF</a>
```

### Setting MIME Types in HTTP Headers
```http
Content-Type: text/html; charset=UTF-8
Content-Type: image/png
Content-Type: application/json
```

## Best Practices

1. Always specify the correct MIME type for web resources
2. Use the most specific MIME type available
3. For text files, include the charset parameter (e.g., `text/html; charset=UTF-8`)
4. For binary files, use `application/octet-stream` as a fallback
5. Keep your server's MIME type configuration up to date

## References
- [IANA Media Types](https://www.iana.org/assignments/media-types/media-types.xhtml)
- [MDN Web Docs: MIME types](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types)
- [W3C MIME Type Specification](https://www.w3.org/Protocols/rfc1341/4_Content-Type.html)