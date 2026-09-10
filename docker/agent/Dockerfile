FROM node:22-alpine

WORKDIR /app

RUN corepack enable

# App code (incl. package.json) is bind-mounted; it arrives in phase D.
CMD ["npm", "run", "start"]
