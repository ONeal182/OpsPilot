FROM node:22-alpine

WORKDIR /app

RUN corepack enable

EXPOSE 5173

# App code (incl. package.json) is bind-mounted; it arrives in phase C.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
