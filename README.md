![web-screenshot](./img/web-screenshot.png?raw=true "Web-демонстрация работы тестов")
## Фреймворк оценки согласованности данных NoSQL систем

Включает реализацию тестов и оценку согласованности данных для NoSQL систем:

- MongoDB
- Redis
- Cassandra

## Запуск

Для корректной работы тестов, необходимо, чтобы в системе были установлены MongoDB,
Redis и Cassandra.  

1. Настройка апи (по-умолчанию занимает порт 3000)

```
cd <path-name>/api
npm install
npm start
```

2. Запуск клиентского тестового приложения (порт 8080)

```
cd <path-name>/web
npm install
npm start
```
