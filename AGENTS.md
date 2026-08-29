# Instruções Para Agentes

Este repositório mantém arquivos de notícias diárias para múltiplos clientes. Cada cliente é uma pasta em `clients/<slug>/` com um `config.json` (regras da busca) e um `noticias.json` (resultado mais recente). Siga este fluxo exatamente, na branch `main`.

## 1. Atualizar o repositório

Antes de qualquer alteração, execute:

```bash
git pull origin main
```

Todo o trabalho deste repositório acontece diretamente na `main`.

## 2. Obter a data atual

```bash
node scripts/get-current-date.js
```

Use a saída desse comando como referência obrigatória da data/hora atual. Ao priorizar notícias publicadas hoje, considere "hoje" com base nessa data, e não por suposição do agente.

## 3. Listar os clientes que precisam de atualização

```bash
node scripts/list-clients.js
```

O script mostra cada cliente e informa quais ainda não foram atualizados hoje (há também `--json` para saída estruturada). Processe **todos os clientes pendentes**, um de cada vez, seguindo os passos 4 a 8 para cada um.

Se todos já estiverem atualizados hoje, não há nada a fazer.

## 4. Ler a configuração do cliente

Leia `clients/<slug>/config.json`. Os campos importantes:

- `busca.prompt`: a regra obrigatória de coleta — siga esse texto como prompt da busca.
- `busca.fontesSugeridas`: links úteis para consultar durante a busca.
- `busca.exclusoes`: temas que nunca podem aparecer nas notícias.
- `validacao.minNoticias` / `validacao.maxNoticias`: quantidade exigida de itens.
- `validacao.maxIdadeDias`: idade máxima de uma notícia em relação à data da busca.
- `idioma`: todo o conteúdo gerado deve estar nesse idioma.

## 5. Buscar as notícias e gerar o arquivo temporário

Busque as notícias reais na web seguindo o `busca.prompt` do cliente e crie o arquivo `clients/<slug>/noticias-temp.json`. Não crie um arquivo vazio, de exemplo ou com placeholders: o conteúdo deve refletir a coleta mais recente e já vir completo neste formato:

```json
{
  "data-busca": "2026-03-19T14:30:00-03:00",
  "noticias": [
    {
      "titulo": "Título da notícia",
      "descricao": "Resumo curto da notícia, em um pequeno parágrafo.",
      "data_publicacao": "2026-03-19T09:00:00-03:00",
      "url": "https://exemplo.com/noticia",
      "fonte": "Nome do veículo"
    }
  ]
}
```

Regras:

- `data-busca` e `data_publicacao` em ISO 8601 com offset, por exemplo `2026-03-19T14:30:00-03:00`.
- `data_publicacao` não pode estar mais de `validacao.maxIdadeDias` dias atrás de `data-busca`; itens mais antigos são rejeitados na validação.
- A prioridade máxima são notícias com a mesma data de `data-busca`; itens de outro dia geram aviso na validação, mas não bloqueiam.
- `descricao` deve ser um resumo curto e original, em um pequeno parágrafo — nunca texto copiado da matéria.
- `url` deve apontar direto para a matéria original (nunca página de listagem) e ser real: não invente URLs.
- A quantidade de itens deve respeitar `validacao.minNoticias` e `validacao.maxNoticias`.

Não sobrescreva `clients/<slug>/noticias.json` manualmente.

## 6. Validar o arquivo temporário

```bash
node scripts/validate-news.js <slug> --temp
```

Se a validação falhar, corrija o `noticias-temp.json` (ou refaça a busca) até passar.

## 7. Arquivar a versão anterior e promover a nova

```bash
node scripts/archive-news.js <slug>
```

Esse script move o `noticias.json` anterior para `clients/<slug>/noticias-anteriores/` (nomeado pela `data-busca` antiga como `noticias-DD-MM-YYYY-HH-mm.json`) e renomeia o `noticias-temp.json` para `noticias.json`.

Em seguida, confirme a validação final:

```bash
node scripts/validate-news.js <slug>
```

## 8. Commit e push do cliente

Somente se a validação final passar, faça o commit **apenas dos arquivos desse cliente** e o push:

```bash
git add clients/<slug>
git commit -m "Atualiza noticias (<slug>)"
git push origin main
```

Um commit por cliente. Se o push falhar por divergência, faça `git pull --rebase origin main` e tente novamente.

## 9. Tratamento de falhas

- Se um cliente falhar (busca insuficiente, validação reprovada etc.), **não** faça commit desse cliente; siga para o próximo cliente pendente e relate a falha no resumo final.
- Nunca faça commit ou push com a validação reprovada.
- Arquivos `noticias-temp.json` não são versionados (estão no `.gitignore`); pode deixar para trás o temporário de um cliente que falhou.

## Resumo do fluxo

```bash
git pull origin main
node scripts/get-current-date.js
node scripts/list-clients.js
# para cada cliente pendente:
#   1. ler clients/<slug>/config.json
#   2. buscar noticias e escrever clients/<slug>/noticias-temp.json
#   3. node scripts/validate-news.js <slug> --temp
#   4. node scripts/archive-news.js <slug>
#   5. node scripts/validate-news.js <slug>
#   6. git add clients/<slug> && git commit -m "Atualiza noticias (<slug>)" && git push origin main
```
