# obcAtlas — Kişisel Dünya Atlası

Dünya atlası; ülkeler, şehirler, yollar, adalar, başkentler, tema seçimi, dil değiştirme ve Türkiye'nin 81 ili için plaka kodu katmanı.

## Windows'ta açmak / arkadaşınla paylaşmak

1. `obcAtlas.zip` dosyasını gönder. Karşı taraf ZIP'i klasöre çıkartsın.
2. Bilgisayarda **Python 3** yüklü olmalı: https://www.python.org/downloads/ . Kurulumda **Add Python to PATH** seçilsin.
3. Klasörde **BASLAT.bat** dosyasına çift tıklasın. Windows güvenlik uyarısı gösterirse yalnızca dosyanın kaynağına güveniyorsa çalıştırsın.
4. Terminal penceresi açıkken tarayıcı otomatik açılır; açılmazsa terminaldeki yerel adresi ziyaret etsin.
5. Bitirince terminali kapatabilir veya Ctrl+C kullanabilir.

Windows'ta `BASLAT.bat` çalışmazsa klasörde komut satırı açıp `py -m http.server 8000` komutuyla, ardından `http://localhost:8000` adresiyle de açılabilir. Port 8000 kullanımda ise `py -m http.server 8001` ve `http://localhost:8001` kullanılabilir.

## Gereksinimler
- Windows ve Python 3 (hazır başlatıcı için). Diğer işletim sistemlerinde `python3 -m http.server 8000` kullanılabilir.
- Aktif internet bağlantısı gerekir: harita karoları, MapLibre, Türkiye sınır verisi ve arama çevrimiçi yüklenir.
- Harita şu an bağımsız bir .exe değildir; paylaşılabilir web projesidir. İki bilgisayarda ayrı ayrı çalıştırılabilir. İnternete yayımlanması için statik hosting kullanılabilir.

## Veri ve sınırlamalar
- MapLibre ve OpenFreeMap: https://maplibre.org/maplibre-gl-js/docs/ ; https://openfreemap.org/
- Türkiye sınır ve plaka verisi: https://github.com/theaiagent/turkiye_iller_geojson
- Arama Nominatim: https://nominatim.org/release-docs/latest/api/Search/ (kullanım limitlerine dikkat edin)
- Bazı yer adları seçilen dile çevrilemeyebilir. Küçük adalar ve yollar veri sağlayıcısının kapsamasına bağlıdır.
- Başkent renk farkı altyapı stilinde ayrı bir başkent katmanı bulunmasına bağlıdır.
- Kullanılan harita ve veri kaynaklarının lisans/atıf şartlarına uyulmalıdır.
