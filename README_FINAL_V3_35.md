# Projeto Natan V3.35 — Final Otimizado PRO

## Fluxo principal

```txt
Admin cria regras, modelos, fluxos e permissões
Gestão controla OS e subtarefas conforme permissões liberadas
Operador executa apenas o que aparece para seu setor
```

## Passos obrigatórios de atualização

1. Substituir todos os arquivos do projeto local pelos arquivos deste ZIP.
2. Atualizar o Apps Script usando `codigo.gs.txt`.
3. Publicar nova versão do Apps Script.
4. Atualizar a URL da API em `js/api.js`, se a implantação do Apps Script gerar nova URL.
5. Rodar no navegador com `Ctrl + F5`.
6. Se o service worker antigo permanecer, limpar dados do site.

## Teste rápido

- ADM1000:
  - abrir Permissões da Gestão;
  - bloquear uma ação, por exemplo Excluir subtarefas.
- GES1000:
  - confirmar que a ação bloqueada não aparece.
- D1000:
  - confirmar que operador só vê OS/subtarefas do próprio setor.

## Foco da V3.35

- estabilidade;
- cache;
- permissões;
- layout;
- redução de chamadas repetidas;
- fluxo profissional para TCC.
