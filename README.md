# Agentic News

Repositório multi-cliente de notícias diárias mantidas por agentes de IA (OpenClaw, Claude Code, Codex etc.). Cada cliente tem uma pasta em `clients/`, com regras próprias de busca em um `config.json` e o resultado mais recente em um `noticias.json` versionado, com histórico das versões anteriores.

Os sites dos clientes consomem os JSONs publicados via GitHub Pages deste repositório:

```text
https://thiagoam.github.io/agentic-news/clients/<slug>/noticias.json
```

## Estrutura do projeto

```text
.
|-- AGENTS.md                  # fluxo operacional para qualquer agente
|-- OPENCLAW.md                # ponteiro para AGENTS.md (compatibilidade)
|-- README.md
|-- clients/
|   |-- cartorio-rio-das-ostras/
|   |   |-- config.json            # regras de busca e validacao do cliente
|   |   |-- noticias.json          # coleta mais recente (consumida pelo site)
|   |   `-- noticias-anteriores/   # historico das versoes ja publicadas
|   `-- advocacia-erika/
|       |-- config.json
|       |-- noticias.json
|       `-- noticias-anteriores/
`-- scripts/
    |-- get-current-date.js    # data/hora atual em ISO 8601 com offset
    |-- list-clients.js        # lista clientes e quais precisam de atualizacao
    |-- validate-news.js       # valida o formato e as regras de um cliente
    |-- archive-news.js        # arquiva a versao anterior e promove a nova
    `-- lib/clients.js         # helpers compartilhados
```

## Contrato de `noticias.json`

Todos os clientes usam o mesmo formato:

```json
{
  "data-busca": "2026-03-19T14:30:00-03:00",
  "noticias": [
    {
      "titulo": "Titulo da noticia",
      "descricao": "Resumo curto em um pequeno paragrafo.",
      "data_publicacao": "2026-03-19T09:00:00-03:00",
      "url": "https://exemplo.com/noticia",
      "fonte": "Nome do veiculo"
    }
  ]
}
```

Regras (limites definidos por cliente em `config.json`, padrao entre parenteses):

- `data-busca`: data e hora da coleta em ISO 8601 com offset.
- `noticias`: array com `validacao.minNoticias` (11) a `validacao.maxNoticias` (17) itens.
- `titulo`, `descricao`, `fonte`: strings nao vazias no idioma do cliente.
- `data_publicacao`: ISO 8601 com offset, no maximo `validacao.maxIdadeDias` (30) dias antes de `data-busca`.
- `url`: URL absoluta com `http` ou `https`, apontando direto para a materia.
- Noticias com `data_publicacao` em dia diferente de `data-busca` passam na validacao, mas geram aviso: a prioridade sao noticias do dia da coleta.

## Fluxo diario

O fluxo completo esta em [AGENTS.md](AGENTS.md). Em resumo, o agente executa diariamente:

```bash
git pull origin main
node scripts/get-current-date.js
node scripts/list-clients.js
# para cada cliente pendente: busca -> noticias-temp.json -> validate --temp -> archive -> validate -> commit/push
```

## Scripts

```bash
node scripts/get-current-date.js                    # data atual (America/Sao_Paulo; use --tz para outra)
node scripts/list-clients.js [--json]               # status de cada cliente
node scripts/validate-news.js <slug>                # valida clients/<slug>/noticias.json
node scripts/validate-news.js <slug> --temp         # valida clients/<slug>/noticias-temp.json
node scripts/validate-news.js --all                 # valida todos os clientes
node scripts/archive-news.js <slug>                 # arquiva a versao atual e promove a temporaria
```

## Como adicionar um cliente

1. Crie `clients/<slug>/config.json` com `nome`, `busca.prompt`, `busca.fontesSugeridas`, `busca.exclusoes` e, se necessario, `validacao` customizada (veja os clientes existentes como modelo).
2. Crie `clients/<slug>/noticias-anteriores/.gitkeep`.
3. A partir da proxima execucao diaria, o agente detecta o cliente novo via `list-clients.js` e gera o primeiro `noticias.json`.
4. No site do cliente, consuma `https://thiagoam.github.io/agentic-news/clients/<slug>/noticias.json`.
5. (Opcional) Para rebuild imediato do site consumidor a cada atualizacao, adicione um job no workflow `notify-consumers.yml`.

## CI

- `validate.yml`: roda `validate-news.js --all` em todo push — rede de seguranca caso um agente commite sem validar.
- `notify-consumers.yml`: quando o `noticias.json` de um cliente muda, dispara `repository_dispatch` no repositorio do site consumidor para rebuild imediato. Requer o secret `CONSUMER_DISPATCH_TOKEN` (fine-grained PAT com permissao de Contents no repo consumidor); sem o secret, o passo e pulado e o site se atualiza no rebuild agendado diario dele.

## Observacoes operacionais

- Todo o conteudo dos JSONs deve permanecer no idioma configurado do cliente (`pt-BR` para os atuais).
- `noticias-temp.json` e um arquivo temporario local e nao deve ser versionado.
- O historico em `clients/<slug>/noticias-anteriores/` deve ser mantido no Git.
- Nao edite `noticias.json` manualmente: o fluxo passa sempre por `noticias-temp.json` + `archive-news.js`.

## Historico

Este repositorio substitui o antigo `noticias-cartorio-rio-das-ostras` (deletado em 29/08/2026), que manteve o mesmo fluxo para um unico cliente. O historico daquele repo foi importado para `clients/cartorio-rio-das-ostras/noticias-anteriores/`.
