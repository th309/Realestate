FROM node:22-slim
WORKDIR /app
COPY package.json tsconfig.json ./
COPY src/ ./src/
RUN npm install
RUN npx tsc
RUN npm prune --omit=dev
EXPOSE 8080
CMD ["node", "dist/http.js"]
