#!/bin/sh
set -e

# Create multiple databases
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE eduplatform_auth;
    CREATE DATABASE eduplatform_user;
    CREATE DATABASE eduplatform_classroom;
    CREATE DATABASE eduplatform_homework;
    CREATE DATABASE eduplatform_exam;
    CREATE DATABASE eduplatform_notification;
    CREATE DATABASE eduplatform_file;
    
    GRANT ALL PRIVILEGES ON DATABASE eduplatform_auth TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE eduplatform_user TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE eduplatform_classroom TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE eduplatform_homework TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE eduplatform_exam TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE eduplatform_notification TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE eduplatform_file TO $POSTGRES_USER;
EOSQL
