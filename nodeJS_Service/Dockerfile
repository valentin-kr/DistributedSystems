FROM node:22-alpine
WORKDIR /app

COPY package.json .
RUN npm install --omit=dev

COPY userServices.js .

EXPOSE 3000
CMD ["node", "userServices.js"]
