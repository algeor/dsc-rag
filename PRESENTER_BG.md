# Сценарий за сцената

1. Натиснете Naive search. Старото ръководство е най-горе, затова отговорът е несигурен и сочи към рискован stale source.
2. Натиснете Indexing. Обяснете: вече търсим по title + metadata + document text, но stale източниците още могат да се състезават.
3. Натиснете Metadata filter. Остават само EU/prod/active/internal документи.
4. Натиснете Query expansion. Добавяме domain terms като contract, VAT, refunds, currency/FX.
5. Натиснете Reranking. По-добрите evidence кандидати се качват нагоре.
6. Натиснете Authority policy. Contracts печелят пред Slack/guide/catalog, когато имаме конфликт.
7. Натиснете Add live check. Покажете параметризираната SQLite проверка и incomplete за DE. „Историческото знание обяснява данните. Live evidence определя дали са приложими сега.“
8. Натиснете Mark complete. „Не сменихме документацията. Сменихме operational state и отговорът се промени.“ Уточнете, че това доказва partition completeness, не всички quality checks.
9. „Подобрението се доказва с измерване. Едно красиво демо не е evaluation.“

За сцената използвайте neural + --llm само след предварителна репетиция. Offline режимът е самостоятелна, ясно обозначена илюстрация на retrieval и live evidence, не доказателство за поведението на LLM. Примерните JSON файлове са резервен запис на offline резултати. Преди всяка репетиция: python3 scripts/demo.py --reset.
