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

## Малък eval за confidence / grounding score

```bash
python3 scripts/eval_confidence.py
python3 scripts/eval_confidence.py --json
```

Това е seed eval с 8-те demo stage-а, не production benchmark. Той сравнява текущия score срещу два етикета:

- grounded: отговорът е подкрепен от правилните evidence източници и не измисля readiness.
- resolved: въпросът за readiness е реално решен чрез live state.

Очакваното заключение е: текущият score мери grounding по-добре от readiness. Затова на сцената е по-честно да се казва Grounding Score, не calibrated confidence.

Основната сценична история вече показва RAG подобрението директно в offline режима и то е видимо в самия отговор, не само в evidence панела. Отговорът е чиста функция на retrieved evidence + live status — нищо не е твърдо кодирано за конкретен бутон. Naive retrieval взима stale source най-отгоре и системата уверено, но ГРЕШНО препоръчва deprecated `finance.daily_revenue` и твърди, че вчерашните данни са готови. С всеки слой (metadata index, query expansion, BM25 върху индекса, deterministic reranking, authority policy) се сменя кои документи влизат в evidence, затова препоръката минава към canonical `finance.fct_net_revenue_v2`, после изисква live check, и накрая разрешава readiness чрез live state. Всичко е inspectable без външни зависимости.

Всеки отговор носи и „Retrieval confidence" (0–100) — детерминистичен grounding score, изчислен само от evidence + live status (вижте `confidence_breakdown` в demo.py за точковия разбор). Той расте по стъпките (~32 → 38 → 60 → 66 → 67 → 82 → 94 → 99), защото retrieval изхвърля stale източници, вдига canonical contract, surface-ва currency + freshness политиките и live check-ът решава readiness. Числото е reproducible от резултатния JSON, не е ръчно зададено. Честно уточнение: при reranking препоръката вече е правилна, затова заглавието не се мени — видимият ефект е пренареждане на evidence панела + лек ръст на confidence.

В UI бутоните са наредени кумулативно: Naive search → Indexing → Metadata filter → Query expansion → Reranking → Authority policy → Add live check → Data lands. Всеки следващ сценарий добавя един слой върху предишния.

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
- Няма обещание за точно подредени отговори от LLM. Offline template е нарочно evidence-order sensitive и отговорът се сменя с evidence: naive уверено, но грешно препоръчва stale `finance.daily_revenue` и халюцинира freshness; с всеки слой препоръката се поправя към canonical contract и readiness-ът минава през live check. „Retrieval confidence" е grounding score от evidence + live status, не calibrated probability.
- check_demo.py е functional regression check, не retrieval benchmark. За claims за подобрение добавете labelled query set и измерете retrieval recall, groundedness, abstention, latency и cost.

## Файлове

- documents/: 16 източника с противоречия, версии и условия.
- data/manifest.json: scope/status/source metadata.
- data/operations.sqlite: live synthetic partition status.
- scripts/demo.py: retrieval, query expansion, RRF, optional neural reranking, live SQL, optional LLM.
- scripts/check_demo.py: проверки и reset.
- PRESENTER_BG.md: сценарий за сцената.
