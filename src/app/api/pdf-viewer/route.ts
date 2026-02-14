import { storePdf } from '@/lib/pdf-store'

function viewerHtml(id: string, fileName: string) {
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>${fileName}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{display:flex;flex-direction:column;height:100vh;font-family:system-ui,sans-serif;background:#0f172a}
.toolbar{padding:8px 12px;background:#1e293b;display:flex;gap:10px;align-items:center;flex-shrink:0}
.toolbar .name{color:#94a3b8;font-size:13px;margin-left:auto}
.btn{padding:7px 18px;border-radius:6px;border:none;cursor:pointer;font-size:13px;font-weight:500;text-decoration:none;display:inline-flex;align-items:center;gap:6px;color:#fff}
.btn-dl{background:#2563eb}
.btn-dl:hover{background:#1d4ed8}
.btn-print{background:#059669}
.btn-print:hover{background:#047857}
embed{flex:1;width:100%}
@media print{.toolbar{display:none}embed{height:100vh}}
</style>
</head><body>
<div class="toolbar">
<a class="btn btn-dl" href="/api/pdf-download/${id}">Télécharger</a>
<button class="btn btn-print" id="printBtn">Imprimer</button>
<span class="name">${fileName}</span>
</div>
<embed src="/api/pdf-download/${id}?inline=1" type="application/pdf">
<script>
document.getElementById('printBtn').addEventListener('click', function() { window.print(); });
</script>
</body></html>`
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const data = formData.get('data') as string
    const fileName = formData.get('fileName') as string

    if (!data || !fileName) {
      return new Response('<html><body><h2>Données manquantes</h2></body></html>', {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    const buffer = Buffer.from(data, 'base64')
    const id = storePdf(buffer, fileName)

    return new Response(viewerHtml(id, fileName), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (error) {
    console.error('Error in pdf-viewer POST:', error)
    return new Response('<html><body><h2>Erreur PDF</h2></body></html>', {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
}
