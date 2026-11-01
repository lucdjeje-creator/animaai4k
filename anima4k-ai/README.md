# ANIMAI 4K AI

Aplicação web inicial para geração de vídeo por texto e imagem usando a fila de inferência do fal.ai.

## Requisitos
- Node.js 20+
- Conta e chave de API no fal.ai (https://fal.ai/dashboard/keys)

## Instalação
1. Extraia o ZIP.
2. Abra a pasta do projeto no terminal.
3. Execute `npm install`.
4. Copie `.env.example` para `.env`.
5. Coloque sua chave em `FAL_KEY`.
6. Confirme no catálogo do fal.ai os IDs e os campos aceitos pelos modelos escolhidos; ajuste `FAL_TEXT_MODEL` e `FAL_IMAGE_MODEL`.
7. Execute `npm start`.
8. Acesse http://localhost:3000.

## API
- `GET /api/health`: verifica servidor e presença da chave.
- `POST /api/generate`: multipart/form-data com `prompt`, `style`, `aspectRatio`, `duration`, `resolution` e, opcionalmente, `image`.
- `GET /api/jobs/:id`: consulta o status e, ao concluir, retorna `videoUrl`.

## Importante sobre 4K
O campo `resolution` registra a qualidade solicitada, mas não força o modelo a produzir 4K. A resolução real depende do modelo contratado e dos parâmetros aceitos por ele. Muitos modelos de vídeo geram em resolução inferior; para entregar 4K real, conecte um modelo/upscaler de vídeo compatível e valide a resolução do arquivo final. O projeto não inventa nem simula um resultado 4K.

## Segurança e produção
- Nunca coloque `FAL_KEY` no JavaScript do navegador.
- O exemplo mantém jobs em memória; reiniciar o servidor apaga o histórico. Use banco de dados para produção.
- Configure autenticação, limites por usuário, quotas, proteção contra abuso, armazenamento privado e política de expiração dos vídeos antes de publicar.
- O upload de referência usa armazenamento do provedor; revise as condições de retenção/privacidade do serviço antes de enviar imagens sensíveis.
- Confira os schemas e endpoints atuais no catálogo/documentação do fal.ai: https://fal.ai/docs/model-apis
