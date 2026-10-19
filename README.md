# Formulários

App de formulários com uma pergunta por tela, hospedado no GitHub Pages, com banco no Supabase.

- Formulário público: `https://giiang3.github.io/forms/#/f/<codigo>`
- Administração: `https://giiang3.github.io/forms/#/admin`

## O que tem

- Editor com 22 tipos de pergunta, grupos de perguntas, lógica de saltos com mapa visual, telas de boas-vindas e finais
- Seletor ao lado do campo de texto (ex.: CPF / RG), cada opção com sua validação
- "Não aceitar resposta repetida" por campo, checado no banco
- Validação de CPF no navegador e no banco
- Campo de e-mail que aceita só domínios escolhidos (ex.: `saude.mg.gov.br`), checado também no banco
- Encerramento manual, por data ou por número de respostas, com mensagem própria
- Incorporar em site (iframe), botão com popup (`embed.js`) e e-mail (primeira pergunta como links)
- Pré-preenchimento pelo link: `#/f/<codigo>?pre_<idDaPergunta>=valor`
- 24 temas, personalização de fonte, cores, fundo e botões, e "Meus temas"
- Protocolo por envio e botão "Baixar comprovante" (PDF) na tela final
- Botão "Adicionar ao Google Agenda" na tela final
- Link curto e QR code por formulário
- Resultados só para admin: visualizações, respostas, taxa de conclusão, tempo de preenchimento, resumo por pergunta, tabela, Excel e CSV

## Como funciona a segurança

O código é público, mas os dados não. A chave do Supabase no código é a chave publicável, feita para ficar no navegador.
As tabelas têm Row Level Security: só usuários cadastrados em `admins` leem e editam.
O público só usa três funções: abrir um formulário publicado, registrar visualização e enviar resposta.
Valores marcados como únicos são guardados como hash (SHA-256 com sal por formulário).

## Desenvolvimento

```bash
npm install
npm run dev
```

O deploy roda sozinho a cada push na `main` (`.github/workflows/deploy.yml`).
