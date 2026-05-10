# OS Motores V5 PRO — Guia de instalação

## 1. Criar a planilha
1. Abra o arquivo `Banco_OS_Motores_V5_PRO.xlsx`.
2. Faça upload para o Google Drive.
3. Abra com Google Sheets.
4. Confira as abas:
   - operadores
   - os
   - checklist
   - subtarefas
   - historico
   - logs
   - modelos_checklist
   - kits_qr
   - config
   - lixeira_os
   - dashboard

## 2. Criar a API no Apps Script
1. Na planilha, clique em `Extensões > Apps Script`.
2. Apague o conteúdo antigo.
3. Copie tudo de `codigo.gs.txt`.
4. Cole no Apps Script.
5. Salve.
6. Rode a função `setupBancoOSMotores` uma vez.
7. Clique em `Implantar > Nova implantação`.
8. Tipo: `App da Web`.
9. Executar como: `Eu`.
10. Quem tem acesso: `Qualquer pessoa`.
11. Copie a URL que termina com `/exec`.

## 3. Ligar API no app
1. Abra `js/api.js`.
2. Troque:
   `COLE_AQUI_SUA_URL_DO_APPS_SCRIPT_EXEC`
   pela URL `/exec`.

## 4. Subir no GitHub Pages
1. Suba todos os arquivos para o repositório.
2. Ative GitHub Pages.
3. Acesse pelo link HTTPS.

## 5. Logins de teste
- Admin: `ADM1000`
- Gestão: `GES1000`
- Elétrica: `E1000`
- Desmontagem: `D1000`
- Montagem: `M1000`
- Usinagem: `U1000`

## 6. QR Codes de teste
Use textos simples em um gerador de QR:
- `OS-2026-0001`
- `0002`
- `SUB:1`
- `KIT-001`

## Observação sobre câmera
Leitor QR precisa de HTTPS ou localhost. GitHub Pages funciona por HTTPS.
