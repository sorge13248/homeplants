import { Body, Controller, Get, Header, Param, Post, Query, Req, Res } from '@nestjs/common';
import { QuickActionService } from '../services/quick-action.service';
import type { Response, Request } from 'express';

function renderSuccessHtml(title: string, message: string, detail?: string) {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - HomePlants</title>
  <style>
    :root {
      --bg: #0f1715;
      --card-bg: rgba(22, 36, 31, 0.85);
      --border: rgba(52, 211, 153, 0.2);
      --text: #f0fdf4;
      --text-muted: #a7f3d0;
      --primary: #10b981;
      --primary-hover: #059669;
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg: #f2f7f4;
        --card-bg: rgba(255, 255, 255, 0.9);
        --border: rgba(16, 185, 129, 0.25);
        --text: #064e3b;
        --text-muted: #047857;
        --primary: #10b981;
        --primary-hover: #059669;
      }
    }
    body {
      margin: 0;
      padding: 1.5rem;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at top, #132a22 0%, var(--bg) 100%);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: var(--text);
      box-sizing: border-box;
    }
    .card {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 2.5rem 2rem;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.4);
      animation: popIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes popIn {
      0% { opacity: 0; transform: scale(0.92); }
      100% { opacity: 1; transform: scale(1); }
    }
    .check-container {
      width: 96px;
      height: 96px;
      margin: 0 auto 1.5rem;
      border-radius: 50%;
      background: rgba(16, 185, 129, 0.15);
      border: 2px solid rgba(16, 185, 129, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
      70% { box-shadow: 0 0 0 20px rgba(16, 185, 129, 0); }
      100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }
    .check-svg {
      width: 56px;
      height: 56px;
      color: #10b981;
      stroke-dasharray: 100;
      stroke-dashoffset: 100;
      animation: drawCheck 0.7s cubic-bezier(0.65, 0, 0.45, 1) forwards 0.2s;
    }
    @keyframes drawCheck {
      100% { stroke-dashoffset: 0; }
    }
    h1 {
      font-size: 1.6rem;
      margin: 0 0 0.75rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    p {
      margin: 0 0 0.5rem;
      color: var(--text-muted);
      font-size: 1rem;
      line-height: 1.5;
    }
    .badge {
      display: inline-block;
      margin-top: 1rem;
      padding: 0.4rem 1rem;
      background: rgba(16, 185, 129, 0.12);
      border-radius: 9999px;
      font-size: 0.85rem;
      font-weight: 600;
      color: #10b981;
    }
    .btn-return {
      display: inline-block;
      margin-top: 1.75rem;
      padding: 0.75rem 1.75rem;
      background: var(--primary);
      color: #ffffff;
      text-decoration: none;
      font-weight: 600;
      border-radius: 12px;
      transition: background 0.2s;
    }
    .btn-return:hover {
      background: var(--primary-hover);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="check-container">
      <svg class="check-svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </div>
    <h1>${title}</h1>
    <p>${message}</p>
    ${detail ? `<div class="badge">${detail}</div>` : ''}
    <div>
      <a href="/" class="btn-return">Apri HomePlants</a>
    </div>
  </div>
</body>
</html>`;
}

function renderSnoozeSelectorHtml(token: string, plantName: string, roomName: string) {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Posticipa Promemoria - HomePlants</title>
  <style>
    :root {
      --bg: #0f1715;
      --card-bg: rgba(22, 36, 31, 0.85);
      --border: rgba(52, 211, 153, 0.2);
      --text: #f0fdf4;
      --text-muted: #a7f3d0;
      --primary: #10b981;
      --primary-hover: #059669;
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg: #f2f7f4;
        --card-bg: rgba(255, 255, 255, 0.9);
        --border: rgba(16, 185, 129, 0.25);
        --text: #064e3b;
        --text-muted: #047857;
        --primary: #10b981;
        --primary-hover: #059669;
      }
    }
    body {
      margin: 0;
      padding: 1.5rem;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at top, #132a22 0%, var(--bg) 100%);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: var(--text);
      box-sizing: border-box;
    }
    .card {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 2.5rem 2rem;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.4);
    }
    .clock-icon {
      width: 56px;
      height: 56px;
      color: #34d399;
      margin: 0 auto 1rem;
    }
    h1 {
      font-size: 1.5rem;
      margin: 0 0 0.5rem;
      font-weight: 700;
    }
    p {
      margin: 0 0 1.5rem;
      color: var(--text-muted);
      font-size: 0.95rem;
      line-height: 1.4;
    }
    .plant-info {
      font-weight: 600;
      color: var(--text);
    }
    .btn-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }
    .btn-grid button:last-child {
      grid-column: span 2;
    }
    button {
      padding: 0.85rem 1rem;
      border: 1px solid var(--border);
      background: rgba(16, 185, 129, 0.12);
      color: var(--text);
      font-size: 1rem;
      font-weight: 600;
      border-radius: 14px;
      cursor: pointer;
      transition: all 0.2s;
    }
    button:hover {
      background: var(--primary);
      color: white;
      transform: translateY(-2px);
      box-shadow: 0 6px 15px -3px rgba(16, 185, 129, 0.4);
    }
  </style>
</head>
<body>
  <div class="card">
    <svg class="clock-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <h1>Ricorda più tardi</h1>
    <p>Quando vuoi che ti venga ricordato di innaffiare <span class="plant-info">${plantName}</span> in <span class="plant-info">${roomName}</span>?</p>
    <form method="POST" action="/api/quick-action/snooze/${token}">
      <div class="btn-grid">
        <button type="submit" name="hours" value="1">Fra 1 ora</button>
        <button type="submit" name="hours" value="4">Fra 4 ore</button>
        <button type="submit" name="hours" value="8">Fra 8 ore</button>
        <button type="submit" name="hours" value="24">Fra 24 ore</button>
        <button type="submit" name="hours" value="48">Fra 48 ore (2 giorni)</button>
      </div>
    </form>
  </div>
</body>
</html>`;
}

function renderErrorHtml(title: string, message: string) {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Avviso - HomePlants</title>
  <style>
    body {
      margin: 0;
      padding: 1.5rem;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0f1715;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #f0fdf4;
      text-align: center;
    }
    .card {
      background: rgba(22, 36, 31, 0.85);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 20px;
      padding: 2rem;
      max-width: 400px;
    }
    h1 { color: #f87171; margin-bottom: 0.5rem; font-size: 1.4rem; }
    p { color: #cbd5e1; margin-bottom: 1.5rem; }
    a {
      display: inline-block;
      padding: 0.6rem 1.25rem;
      background: #10b981;
      color: white;
      text-decoration: none;
      border-radius: 10px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="/">Vai a HomePlants</a>
  </div>
</body>
</html>`;
}

@Controller('quick-action')
export class QuickActionController {
  constructor(private readonly quickActionService: QuickActionService) {}

  @Get('water/:token')
  async water(
    @Req() req: Request,
    @Res() res: Response,
    @Param('token') token: string,
  ) {
    const isJson = req.headers.accept?.includes('application/json');

    try {
      const result = await this.quickActionService.executeWater(token);
      const plantName = result.roomPlant.plant?.commonName ?? 'Pianta';
      const roomName = result.roomPlant.room?.name ?? 'Stanza';

      if (isJson) {
        return res.json({
          success: true,
          plantName,
          roomName,
          wateredAt: new Date().toISOString(),
        });
      }

      const html = renderSuccessHtml(
        'Innaffiatura Registrata!',
        `Ottimo lavoro! Abbiamo segnato che hai innaffiato <strong>${plantName}</strong> nella stanza <strong>${roomName}</strong>.`,
        'Prossimo promemoria programmato',
      );
      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
    } catch (err: any) {
      if (isJson) {
        return res.status(400).json({ error: err.message });
      }
      res.setHeader('Content-Type', 'text/html');
      return res.status(400).send(renderErrorHtml('Azione non completata', err.message));
    }
  }

  @Get('snooze/:token')
  async getSnoozePage(
    @Req() req: Request,
    @Res() res: Response,
    @Param('token') token: string,
  ) {
    try {
      const { roomPlant } = await this.quickActionService.resolveToken(token);
      const plantName = roomPlant.plant?.commonName ?? 'Pianta';
      const roomName = roomPlant.room?.name ?? 'Stanza';

      res.setHeader('Content-Type', 'text/html');
      return res.send(renderSnoozeSelectorHtml(token, plantName, roomName));
    } catch (err: any) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(400).send(renderErrorHtml('Link non valido', err.message));
    }
  }

  @Post('snooze/:token')
  async postSnooze(
    @Req() req: Request,
    @Res() res: Response,
    @Param('token') token: string,
    @Body('hours') bodyHours?: string | number,
  ) {
    const isJson = req.headers.accept?.includes('application/json');
    const hours = Number(bodyHours) || 24;

    try {
      const result = await this.quickActionService.executeSnooze(token, hours);
      const plantName = result.roomPlant.plant?.commonName ?? 'Pianta';
      const roomName = result.roomPlant.room?.name ?? 'Stanza';

      if (isJson) {
        return res.json({
          success: true,
          hours,
          plantName,
          roomName,
        });
      }

      const html = renderSuccessHtml(
        'Promemoria Posticipato!',
        `Il promemoria per <strong>${plantName}</strong> (${roomName}) è stato posticipato di <strong>${hours} ${hours === 1 ? 'ora' : 'ore'}</strong>.`,
        `Ti ricorderemo di nuovo tra ${hours}h`,
      );
      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
    } catch (err: any) {
      if (isJson) {
        return res.status(400).json({ error: err.message });
      }
      res.setHeader('Content-Type', 'text/html');
      return res.status(400).send(renderErrorHtml('Azione non completata', err.message));
    }
  }
}

