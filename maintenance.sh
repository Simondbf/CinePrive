#!/bin/bash

# ==========================================
# Script de Maintenance Quotidienne (06h50)
# ==========================================

LOG_FILE="/var/log/maintenance.log"

echo "==========================================" >> $LOG_FILE
echo "Début de la maintenance : $(date)" >> $LOG_FILE
echo "==========================================" >> $LOG_FILE

# 1. Nettoyage Docker
echo "[1/3] Nettoyage Docker (docker system prune -f)..." >> $LOG_FILE
docker system prune -f >> $LOG_FILE 2>&1

# 2. Mise à jour du système
echo "[2/3] Mise à jour des paquets (apt update && apt upgrade -y)..." >> $LOG_FILE
apt update >> $LOG_FILE 2>&1
DEBIAN_FRONTEND=noninteractive apt upgrade -y >> $LOG_FILE 2>&1

# 3. Nettoyage des dépendances
echo "[3/3] Suppression des dépendances inutiles (apt autoremove -y)..." >> $LOG_FILE
apt autoremove -y >> $LOG_FILE 2>&1

echo "==========================================" >> $LOG_FILE
echo "Fin de la maintenance : $(date)" >> $LOG_FILE
echo "==========================================" >> $LOG_FILE
