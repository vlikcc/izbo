# Saklama politikası

- Refresh token kayıtları: 90 gün (süresi dolmuş ve iptal edilmiş satırlar budanabilir)
- Outbox e-posta kayıtları: 30 gün
- Denetim (audit) olayları: 365 gün
- Silinen hesaplar: PII anonimleştirilir; yedekler `BACKUP_RETENTION_DAYS` (varsayılan 14) sonra silinir
- MinIO nesneleri: dosya silme isteği metadata ve nesneyi birlikte kaldırır

Bu süreler yasal yükümlülüklere göre `.env` üzerinden uzatılabilir.
