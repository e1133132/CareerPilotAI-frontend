FROM python:3.12-slim

RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

ARG USERNAME=cbchanhanbear
RUN useradd -m -s /bin/bash "${USERNAME}" \
  && chown -R "${USERNAME}":"${USERNAME}" /app

USER ${USERNAME}

CMD ["python", "app.py"]
