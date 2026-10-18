# ====================================================================
# STAGE 1: Build React Vite Frontend
# ====================================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci || npm install

COPY frontend/ ./
RUN npm run build

# ====================================================================
# STAGE 2: Build Spring Boot Backend with embedded static frontend
# ====================================================================
FROM maven:3.9.6-eclipse-temurin-17-alpine AS backend-builder
WORKDIR /app/backend

COPY backend/pom.xml ./
RUN mvn dependency:go-offline -B || true

COPY backend/src ./src
# Copy production frontend build into Spring Boot static resources
COPY --from=frontend-builder /app/frontend/dist ./src/main/resources/static

RUN mvn clean package -DskipTests -B

# ====================================================================
# STAGE 3: Minimal Production JRE Runtime Container
# ====================================================================
FROM eclipse-temurin:17-jre-alpine AS runner
WORKDIR /app

# Create non-root user for security
RUN addgroup -S studygroup && adduser -S studyapp -G studygroup

# Create directory for persistent local H2 storage
RUN mkdir -p /app/data && chown -R studyapp:studygroup /app

COPY --from=backend-builder --chown=studyapp:studygroup /app/backend/target/*.jar /app/app.jar

USER studyapp

ENV PORT=8080 \
    APP_PASSWORD=studyapp123 \
    APP_TIMEZONE=Asia/Ho_Chi_Minh \
    JAVA_OPTS="-XX:+UseG1GC -XX:MaxRAMPercentage=75.0 -Djava.security.egd=file:/dev/./urandom"

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:${PORT}/api/auth/status || exit 1

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -Dserver.port=${PORT} -jar /app/app.jar"]
