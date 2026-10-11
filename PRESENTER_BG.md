# Сценарий за сцената

Отговорът е чиста функция на retrieved evidence + live status (нищо не е твърдо кодирано за всеки бутон). Всеки слой сменя кои документи влизат в evidence, затова отговорът и „Retrieval confidence" (0–100) се променят видимо на всяко кликване. Reproducible: прочетете `evidence` масива в JSON-а, за да видите защо отговорът казва това, което казва.

1. Натиснете Naive search. Старото ръководство е най-отгоре, затова системата уверено, но ГРЕШНО сочи deprecated `finance.daily_revenue` и твърди, че вчерашните данни са готови. Confidence ~32. „Това е халюцинираната увереност."
2. Натиснете Indexing. Вече търсим по title + metadata + document text, затова canonical contract се качва (позиция 3), но stale guide още го изпреварва — отговорът е все още грешен. Confidence ~38.
3. Натиснете Metadata filter. Остават само EU/prod/active/internal документи; deprecated източници изчезват и отговорът минава към `finance.fct_net_revenue_v2`. Confidence ~60.
4. Натиснете Query expansion. Domain terms (contract, VAT, refunds, currency/FX) качват самия canonical contract до върха. Confidence ~66.
5. Натиснете Reranking. Deterministic reranker подрежда evidence по качество — по-силен corroborating източник влиза в top-5 (вижте как Evidence панелът се пренарежда). Препоръката вече е правилна, затова заглавието не се мени; confidence се вдига до ~67. Честно: при вече добър retrieval reranking мести малко.
6. Натиснете Authority policy. Contracts печелят пред Slack/guide/catalog; influх на freshness/FX policy документи кара отговора да изисква live check вместо да гадае. Confidence ~82.
7. Натиснете Add live check. Параметризираната SQLite проверка показва incomplete за DE → NOT ready. „Историческото знание обяснява данните. Live evidence определя дали са приложими сега." Confidence ~94.
8. Натиснете Data lands. „Не сменихме документацията. Сменихме operational state и отговорът се промени." Confidence ~99. Уточнете, че това доказва partition completeness, не всички quality checks.
9. „Подобрението се доказва с измерване. Едно красиво демо не е evaluation."

За сцената използвайте neural + --llm само след предварителна репетиция. Offline режимът е самостоятелна, ясно обозначена илюстрация на retrieval и live evidence, не доказателство за поведението на LLM. Примерните JSON файлове са резервен запис на offline резултати. Преди всяка репетиция: python3 scripts/demo.py --reset.
