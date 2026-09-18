FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4242
COPY --chown=node:node backend/*.mjs ./backend/
USER node
EXPOSE 4242
CMD ["node", "backend/server.mjs"]
