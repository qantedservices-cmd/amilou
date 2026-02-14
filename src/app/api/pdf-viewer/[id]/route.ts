import { getPdf } from '@/lib/pdf-store'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const entry = getPdf(id)

  if (!entry) {
    return new Response('<html><body><h2>PDF expiré ou introuvable</h2></body></html>', {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>${entry.fileName}</title>
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
<span class="name">${entry.fileName}</span>
</div>
<embed src="/api/pdf-download/${id}?inline=1" type="application/pdf">
<script>
document.getElementById('printBtn').addEventListener('click', function() { window.print(); });
</script>
</body></html>`

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
