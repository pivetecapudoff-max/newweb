# Farol

Painel local para criadores UGC verem quais temas o catálogo Roblox está repetindo.

Farol não é o Keyword Tracker da Avalanche e não usa a marca deles. É um produto próprio: outro nome, outro texto, outra coleta (API pública, com pausa entre pedidos).

## Como rodar

```bash
cd farol
npm install
npm run dev
```

- Interface: http://127.0.0.1:5174
- API: http://127.0.0.1:8788

Depois do primeiro `npm run build`, `npm start` serve a API e os arquivos estáticos na porta 8788.

## O que já funciona

- Varredura contínua no servidor (padrão: a cada 12 minutos; “Varrer agora” ainda existe)
- Preview com miniaturas públicas do catálogo no feed e no detalhe do tema
- Bundles/personagens quando a busca pública devolve `Bundle`
- Agrupamento TF-IDF + cosseno
- Vereditos, selos, busca, filtro, ordenação
- Histórico em `data/state.json` (aceleração depois de 2 ciclos)
- Alerta local por limiar + exportação CSV
- Overlay de referências: lista curada; AniList/Jikan se o ambiente deixar
- Demanda por tema: campo `Sales` da Economy API; se vier 0, usa favoritos do catálogo e avisa no painel

## Limites

- Volume menor do que um rastreador pago com várias sessões
- Tokenização afinada em inglês
- Não garante venda
- Sem Telegram/e-mail nesta versão
