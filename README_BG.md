# From Data to Answers: Where Does Truth Get Lost in RAG?

Работещ starter kit за 4–5 минути демонстрация. Всички данни и документи са измислени. Текстовете са на английски за презентацията.

## Стартиране без зависимости (Python 3.10+)

Отворете terminal в тази папка:

```bash
python3 scripts/check_demo.py
python3 scripts/demo.py --mode naive --reset
python3 scripts/demo.py --mode context
python3 scripts/demo.py --mode live
python3 scripts/demo.py --mode live --set-de complete
python3 scripts/demo.py --mode live --reset
```

Резултатът е JSON с evidence, trace и answer. Примерни резултати са в data/example_*.json. Проверявайте evidence, не само последния отговор.

Основната сценична история вече показва RAG подобрението директно в offline режима: naive retrieval взима stale source най-отгоре, а Indexed RAG използва metadata index, query expansion, BM25 върху индекса и deterministic reranking, за да вдигне canonical contract най-отгоре. Това е inspectable демо без външни зависимости.

В UI бутоните са наредени кумулативно: Naive search → Indexing → Metadata filter → Query expansion → Reranking → Authority policy → Add live check → Mark complete. Всеки следващ сценарий добавя един слой върху предишния.

## Истински embeddings, hybrid retrieval и cross-encoder

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-neural.txt
python3 scripts/demo.py --mode naive --backend neural
python3 scripts/demo.py --mode context --backend neural
python3 scripts/demo.py --mode live --backend neural
```

Първото стартиране изтегля MiniLM и cross-encoder от Hugging Face. Изпълнете предварително преди сцената. На Windows използвайте .venv\Scripts\activate. При neural backend naive използва dense retrieval; context/live използват BM25 + dense, reciprocal rank fusion, cross-encoder и отделна authority policy. Offline context/live използват локален индекс и deterministic reranker, за да е видим RAG ефектът без download. Embeddings се изчисляват при всяко пускане за малкия корпус; това не е production vector index.

## Генериране с LLM

Задайте OPENAI_API_KEY като environment variable чрез вашия secret manager или terminal; не го записвайте в файловете. По желание задайте OPENAI_MODEL (по подразбиране gpt-4.1-mini).

```bash
python3 scripts/demo.py --mode live --backend neural --llm
```

Този режим изпраща синтетичните retrieved documents и статуса към OpenAI API и изисква платен API достъп. Без --llm отговорът е детерминистичен evidence template, не LLM. Neural/API пътищата са предоставени, но не са изпълнени и проверени в средата за създаване на този комплект. Offline режимът и SQLite мутациите са проверени.

## Ablations

```bash
python3 scripts/demo.py --mode live --disable live
python3 scripts/demo.py --mode context --disable context
python3 scripts/demo.py --mode context --disable metadata --disable authority
python3 scripts/demo.py --mode context --backend neural --disable rerank
python3 scripts/demo.py --mode context --backend neural --disable hybrid
python3 scripts/demo.py --mode context --backend neural --disable rewrite
```

--disable може да се повтори. hybrid има ефект само при neural backend. rerank има offline deterministic вариант и neural cross-encoder вариант. rewrite е фиксирано domain expansion, не LLM rewrite. context премахва всичко след първото изречение като илюстрация на загубено условие. Всеки документ е един semantic chunk; няма автоматичен chunker. Изключването на подобрение не гарантира грешен отговор: показвайте действителните evidence и резултати.

## Ограничения и честно представяне

- Demo date е 2026-10-10, а yesterday е 2026-10-09. Използвайте --date YYYY-MM-DD за друга business date. Датата се подава изрично, не се извлича от свободния въпрос.
- Retrieval е специализиран за EU net revenue и фиксиран demo user с internal достъп. Това не е general assistant, реална authentication/ACL система или NL-to-SQL.
- SQLite съдържа operational metadata, не транзакционен warehouse. Live query е фиксирана, параметризирана SELECT заявка.
- DE, FR, PL са цялото очаквано покритие на измисления dataset, не всички страни в ЕС.
- Complete означава налични demo partitions. Не доказва FX readiness, всички quality checks или вярност на upstream данните.
- Authority policy е явно приложена след reranking. Не приписвайте ефекта ѝ на cross-encoder.
- Няма обещание за точно подредени отговори от LLM. Offline template е нарочно evidence-order sensitive: naive показва риска от stale top source, Indexed RAG показва по-добър retrieval ред.
- check_demo.py е functional regression check, не retrieval benchmark. За claims за подобрение добавете labelled query set и измерете retrieval recall, groundedness, abstention, latency и cost.

## Файлове

- documents/: 16 източника с противоречия, версии и условия.
- data/manifest.json: scope/status/source metadata.
- data/operations.sqlite: live synthetic partition status.
- scripts/demo.py: retrieval, query expansion, RRF, optional neural reranking, live SQL, optional LLM.
- scripts/check_demo.py: проверки и reset.
- PRESENTER_BG.md: сценарий за сцената.
