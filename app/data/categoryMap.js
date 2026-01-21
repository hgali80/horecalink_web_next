// app/data/categoryMap.js
// URL KEY  ->  Firestore TR METİN eşleşmesi
// categoryData.js ile %100 BİREBİR SENKRON
// Firestore sorgularının TEK referansıdır.

export const categoryMap = {
  /* =====================================================
     KURUMSAL / TÜKETİM
     ===================================================== */

  // KAĞIT ÜRÜNLER
  toilet_paper: { main: "Kağıt Ürünler", sub: "Tuvalet Kağıtları" },
  paper_towels: { main: "Kağıt Ürünler", sub: "Kağıt Havlular" },
  napkins: { main: "Kağıt Ürünler", sub: "Peçeteler" },
  toilet_seat_hygiene_covers: {
    main: "Kağıt Ürünler",
    sub: "Klozet Kapağı Hijyen Kağıtları",
  },

  // KİŞİSEL BAKIM & HİJYEN
  liquid_foam_soap: {
    main: "Kişisel Bakım ve Hijyen",
    sub: "Sıvı Ve Köpük Sabunlar",
  },
  shampoo_shower_gel: {
    main: "Kişisel Bakım ve Hijyen",
    sub: "Şampuan ve Duş Jelleri",
  },
  air_fresheners: {
    main: "Kişisel Bakım ve Hijyen",
    sub: "Oda Kokuları",
  },
  wet_wipes: {
    main: "Kişisel Bakım ve Hijyen",
    sub: "Islak Havlu ve Mendiller",
  },
  disinfectants: {
    main: "Kişisel Bakım ve Hijyen",
    sub: "Dezenfektanlar",
  },

  // TEMİZLİK EKİPMANLARI
  kitchen_cleaning_equipment: {
    main: "Temizlik Ekipmanları",
    sub: "Mutfak Temizlik Ekipmanları",
  },
  surface_cleaning_cloths: {
    main: "Temizlik Ekipmanları",
    sub: "Yüzey Temizlik Bezleri",
  },
  floor_cleaning_equipment: {
    main: "Temizlik Ekipmanları",
    sub: "Zemin Temizlik Ekipmanları",
  },
  glass_cleaning_equipment: {
    main: "Temizlik Ekipmanları",
    sub: "Cam Temizlik Ekipmanları",
  },
  wc_bathroom_cleaning_equipment: {
    main: "Temizlik Ekipmanları",
    sub: "WC ve Banyo Temizlik Ekipmanları",
  },

  // TEMİZLİK KİMYASALLARI
  kitchen_cleaning_chemicals: {
    main: "Temizlik Kimyasalları",
    sub: "Mutfak Temizlik Ürünleri",
  },
  floor_cleaning_chemicals: {
    main: "Temizlik Kimyasalları",
    sub: "Zemin Temizlik Ürünleri",
  },
  laundry_products: {
    main: "Temizlik Kimyasalları",
    sub: "Çamaşırhane Ürünleri",
  },
  wc_bathroom_cleaning_chemicals: {
    main: "Temizlik Kimyasalları",
    sub: "WC ve Banyo Temizlik Kimyasalları",
  },
  glass_cleaning_chemicals: {
    main: "Temizlik Kimyasalları",
    sub: "Cam Temizlik Ürünleri",
  },
  pool_chemicals: {
    main: "Temizlik Kimyasalları",
    sub: "Havuz Ürünleri",
  },

  // PERSONEL KORUYUCU
  masks: { main: "Personel Koruyucu Ürünler", sub: "Maskeler" },
  hair_nets: { main: "Personel Koruyucu Ürünler", sub: "Boneler" },
  aprons: { main: "Personel Koruyucu Ürünler", sub: "Önlükler" },
  shoe_covers: { main: "Personel Koruyucu Ürünler", sub: "Galoşlar" },
  gloves: { main: "Personel Koruyucu Ürünler", sub: "Eldiven" },

  // PORSİYON
  sugar_packets: { main: "Porsiyon Ürünler", sub: "Şekerler" },
  wet_wipes_portion: { main: "Porsiyon Ürünler", sub: "Islak Mendiller" },

  // TEK KULLANIMLIK
  cups: { main: "Tek Kullanımlık Ürünler", sub: "Bardaklar" },
  aluminum_containers: {
    main: "Tek Kullanımlık Ürünler",
    sub: "Alüminyum Konteyner",
  },
  toothpicks: { main: "Tek Kullanımlık Ürünler", sub: "Kürdanlar" },
  cutlery_sets: {
    main: "Tek Kullanımlık Ürünler",
    sub: "Çatal - Bıçak - Kaşık",
  },
  stirrers_straws: {
    main: "Tek Kullanımlık Ürünler",
    sub: "Pipet ve Karıştırıcı",
  },

  // DİSPENSERLER
  liquid_soap_dispensers: {
    main: "Dispenserler",
    sub: "Sıvı Sabun Dispenserleri",
  },
  foam_soap_dispensers: {
    main: "Dispenserler",
    sub: "Köpük Sabun Dispenserleri",
  },
  toilet_seat_cover_dispensers: {
    main: "Dispenserler",
    sub: "Klozet Kapağı Kağıdı Dispenserleri",
  },
  air_freshener_dispensers: {
    main: "Dispenserler",
    sub: "AirFresh Dispenserleri",
  },
  toilet_paper_dispensers: {
    main: "Dispenserler",
    sub: "Tuvalet Kağıdı Dispenseri",
  },
  paper_towel_dispensers: {
    main: "Dispenserler",
    sub: "Kağıt Havlu Dispenseri",
  },
  tabletop_napkin_dispensers: {
    main: "Dispenserler",
    sub: "Masaüstü Peçete Dispenseri",
  },

  // AMBALAJ
  aluminum_foils: {
    main: "Ambalaj Ürünleri",
    sub: "Alüminyum Folyolar",
  },
  stretch_films: {
    main: "Ambalaj Ürünleri",
    sub: "Streç Filmler",
  },
  baking_paper: {
    main: "Ambalaj Ürünleri",
    sub: "Pişirme Kağıtları",
  },
  trash_bags: {
    main: "Ambalaj Ürünleri",
    sub: "Çöp Torbası ve Poşetler",
  },

  // DEPOLAMA & TAŞIMA
  packaging_stretch_films: {
    main: "Depolama ve Taşıma Ürünleri",
    sub: "Paketleme Strec Filmleri",
  },
  packing_tapes: {
    main: "Depolama ve Taşıma Ürünleri",
    sub: "Koli Bantları",
  },

  /* =====================================================
     YATIRIM / EKİPMAN
     ===================================================== */

  butcher_knives: { main: "Chef Bıçakları", sub: "Kasap Bıçakları" },
  boning_knives: { main: "Chef Bıçakları", sub: "Kemik Sıyırma Bıçakları" },
  slicing_knives: { main: "Chef Bıçakları", sub: "Dilimleme Bıçakları" },
  meat_chopping_knives: {
    main: "Chef Bıçakları",
    sub: "Et Doğrama Bıçakları",
  },
  chef_knives: { main: "Chef Bıçakları", sub: "Şef Bıçakları" },
  vegetable_knives: { main: "Chef Bıçakları", sub: "Sebze Bıçakları" },
  cheese_knives: { main: "Chef Bıçakları", sub: "Peynir Bıçakları" },
  bread_knives: { main: "Chef Bıçakları", sub: "Ekmek Bıçakları" },
  cleavers: { main: "Chef Bıçakları", sub: "Satır Bıçakları" },
  zirh_knives: { main: "Chef Bıçakları", sub: "Zırh Bıçakları" },
  knife_sharpeners: { main: "Chef Bıçakları", sub: "Masatlar" },
  cake_spatulas: { main: "Chef Bıçakları", sub: "Pasta Paletleri" },
  pizza_knives: { main: "Chef Bıçakları", sub: "Pizza Bıçakları" },
  doner_knives: { main: "Chef Bıçakları", sub: "Döner Bıçakları" },
  meat_tenderizers: { main: "Chef Bıçakları", sub: "Et Dövecekleri" },

  tea_machines: { main: "Çay Kahve Grubu", sub: "Çay Makineleri" },
  coffee_stoves: { main: "Çay Kahve Grubu", sub: "Kahveci Ocakları" },
  coffee_machines: { main: "Çay Kahve Grubu", sub: "Kahve Makineleri" },
  double_wall_tea_machines: {
    main: "Çay Kahve Grubu",
    sub: "Çift Cidarlı Çay Makineleri",
  },
  copper_teapots: {
    main: "Çay Kahve Grubu",
    sub: "Bakır Çaydanlıklar",
  },

  toasters: { main: "Pişirme Grubu", sub: "Tost Makineleri" },
  doner_grills: { main: "Pişirme Grubu", sub: "Döner Ocakları" },
  grills: { main: "Pişirme Grubu", sub: "Izgaralar" },
  ovens_and_ranges: {
    main: "Pişirme Grubu",
    sub: "Ocak Ve Fırınlar",
  },
  waffle_machines: {
    main: "Pişirme Grubu",
    sub: "Waffle Makineleri",
  },
  fryers: { main: "Pişirme Grubu", sub: "Fritözler" },
  crepe_machines: {
    main: "Pişirme Grubu",
    sub: "Krep Makineleri",
  },
  pancake_machines: {
    main: "Pişirme Grubu",
    sub: "Pankek Makineleri",
  },
  sausage_cookers: {
    main: "Pişirme Grubu",
    sub: "Sosis Pişiriciler",
  },
  pasta_cookers: {
    main: "Pişirme Grubu",
    sub: "Makarna Haşlama Makineleri",
  },

  juice_ayran_coolers: {
    main: "Soğutma Grubu",
    sub: "Meyve Suyu ve Ayran Soğutucular",
  },
  slush_machines: {
    main: "Soğutma Grubu",
    sub: "Slush (Buzlaş) Makineleri",
  },
  ice_machines: { main: "Soğutma Grubu", sub: "Buz Makineleri" },
  refrigerators: {
    main: "Soğutma Grubu",
    sub: "Soğutucu Dolaplar",
  },

  soup_warmers: { main: "Servis Ürünleri", sub: "Çorba Isıtıcılar" },
  bain_marie: { main: "Servis Ürünleri", sub: "Benmariler" },
  heated_sauce_warmers: {
    main: "Servis Ürünleri",
    sub: "Isıtıcılı Sosluklar",
  },

  hood_type_dishwashers: {
    main: "Bulaşık Makineleri",
    sub: "Giyotin Tip Bulaşık Makineleri",
  },
  undercounter_dishwashers: {
    main: "Bulaşık Makineleri",
    sub: "Tezgah Altı Bulaşık Makineleri",
  },

  orange_juicers: {
    main: "Hazırlık Ekipmanları",
    sub: "Portakal Sıkma Makinesi",
  },
  onion_choppers: {
    main: "Hazırlık Ekipmanları",
    sub: "Soğan Doğrama Makinesi",
  },
  potato_slicers: {
    main: "Hazırlık Ekipmanları",
    sub: "Patates Dilimleme Makinesi",
  },
  bar_blenders: { main: "Hazırlık Ekipmanları", sub: "Bar Blender" },
  burger_presses: {
    main: "Hazırlık Ekipmanları",
    sub: "Hamburger Köfte Presi",
  },
  mixers: { main: "Hazırlık Ekipmanları", sub: "Mikserler" },
  dough_kneaders: {
    main: "Hazırlık Ekipmanları",
    sub: "Hamur Yoğurma Makineleri",
  },
  dough_rollers: {
    main: "Hazırlık Ekipmanları",
    sub: "Hamur Açma Makineleri",
  },
  meat_grinders: {
    main: "Hazırlık Ekipmanları",
    sub: "Kıyma Makineleri",
  },

  /* =====================================================
     PASLANMAZ
     ===================================================== */

  flat_tables: { main: "Tezgâhlar", sub: "Düz Tezgâhlar" },
  bottom_shelf_tables: {
    main: "Tezgâhlar",
    sub: "Taban Raflı Tezgâhlar",
  },
  mid_shelf_tables: {
    main: "Tezgâhlar",
    sub: "Taban Ara Raflı Tezgâhlar",
  },
  single_drawer_tables: {
    main: "Tezgâhlar",
    sub: "Tezgâhlar - 1 Çekmeceli",
  },
  drawer_block_tables: {
    main: "Tezgâhlar",
    sub: "Tezgâhlar - Çekmece Bloğu",
  },
  sliding_door_cabinets: {
    main: "Tezgâhlar",
    sub: "Dolaplı Tezgâh - Sürgülü Kapı",
  },
  swing_door_cabinets: {
    main: "Tezgâhlar",
    sub: "Dolaplı Tezgâh - Çarpma Kapı",
  },
  heated_cabinet_tables: {
    main: "Tezgâhlar",
    sub: "Isıtmalı Dolaplı Tezgâh",
  },
  marble_top_tables: {
    main: "Tezgâhlar",
    sub: "Mermer Tablalı Tezgâhlar",
  },
  polyethylene_top_tables: {
    main: "Tezgâhlar",
    sub: "PE (Polietilen) Tablalı Tezgâhlar",
  },
  mobile_tables: {
    main: "Tezgâhlar",
    sub: "Tezgâhlar - Tekerlekli",
  },

  cabinet_sink_units: {
    main: "Evyeli Tezgâhlar",
    sub: "Evyeli Tezgah Dolaplı",
  },
  single_sink_units: {
    main: "Evyeli Tezgâhlar",
    sub: "1 Evyeli Tezgâhlar",
  },
  double_sink_units: {
    main: "Evyeli Tezgâhlar",
    sub: "2 Evyeli Tezgâhlar",
  },
  triple_sink_units: {
    main: "Evyeli Tezgâhlar",
    sub: "3 Evyeli Tezgâhlar",
  },
  welded_single_sink_units: {
    main: "Evyeli Tezgâhlar",
    sub: "1 Evyeli Tezgâhlar (Kaynaklı Evyeli)",
  },
  welded_double_sink_units: {
    main: "Evyeli Tezgâhlar",
    sub: "2 Evyeli Tezgâhlar (Kaynaklı Evyeli)",
  },
  welded_triple_sink_units: {
    main: "Evyeli Tezgâhlar",
    sub: "3 Evyeli Tezgâhlar (Kaynaklı Evyeli)",
  },
  cleaning_sinks: {
    main: "Evyeli Tezgâhlar",
    sub: "Temizlik Evyesi",
  },
  knee_control_handwash_units: {
    main: "Evyeli Tezgâhlar",
    sub: "Diz Kontrollü El Yıkama Ünitesi",
  },

  dishwasher_inlet_tables: {
    main: "Bulaşık Makinesi Tezgâhları",
    sub: "Bulaşık Makinesi Giriş Tezgâhları",
  },
  dishwasher_outlet_tables: {
    main: "Bulaşık Makinesi Tezgâhları",
    sub: "Bulaşık Makinesi Çıkış Tezgâhları",
  },
  scrap_tables: {
    main: "Bulaşık Makinesi Tezgâhları",
    sub: "Bulaşık Sıyırma Tezgâhları",
  },
  dishwasher_basket_shelves: {
    main: "Bulaşık Makinesi Tezgâhları",
    sub: "Bulaşık Makinesi Basketi Rafı",
  },

  pot_washing_tables: {
    main: "Kazan & Sebze Yıkama Tezgâhları",
    sub: "Kazan Yıkama Tezgâhı",
  },
  pot_washing_service_tables: {
    main: "Kazan & Sebze Yıkama Tezgâhları",
    sub: "Kazan Yıkama Servis Masası",
  },
  vegetable_washing_tables: {
    main: "Kazan & Sebze Yıkama Tezgâhları",
    sub: "Sebze Yıkama Tezgâhı",
  },
  fish_processing_tables: {
    main: "Kazan & Sebze Yıkama Tezgâhları",
    sub: "Balık İşleme Tezgâhı",
  },

  wall_cabinets: {
    main: "Raf & Dolap Sistemleri",
    sub: "Duvar Dolap - Kapaklı",
  },
  wall_shelves: {
    main: "Raf & Dolap Sistemleri",
    sub: "Duvar Rafı",
  },
  cutting_board_shelves: {
    main: "Raf & Dolap Sistemleri",
    sub: "Raf - Kesme Tahtası İçin",
  },
  industrial_shelving_systems: {
    main: "Raf & Dolap Sistemleri",
    sub: "Endüstriyel Raf Sistemleri",
  },
  stacking_shelves: {
    main: "Raf & Dolap Sistemleri",
    sub: "İstif Rafları",
  },
  pot_shelves: {
    main: "Raf & Dolap Sistemleri",
    sub: "Kazan Rafları",
  },
  plate_drying_shelves: {
    main: "Raf & Dolap Sistemleri",
    sub: "Tabak Kurutma Rafları",
  },

  storage_platform_trolleys: {
    main: "Tabla & Tepsi Arabaları",
    sub: "Depo İstif Tablası",
  },
  plate_trolleys: {
    main: "Tabla & Tepsi Arabaları",
    sub: "Tabak Arabası",
  },
  pot_trolleys: {
    main: "Tabla & Tepsi Arabaları",
    sub: "Kazan Arabası",
  },
  two_tier_service_trolleys: {
    main: "Tabla & Tepsi Arabaları",
    sub: "Servis Arabaları - 2 Katlı",
  },
  three_tier_service_trolleys: {
    main: "Tabla & Tepsi Arabaları",
    sub: "Servis Arabaları - 3 Katlı",
  },
  platform_trolleys: {
    main: "Tabla & Tepsi Arabaları",
    sub: "Platform Arabası",
  },
  gn_container_trolleys: {
    main: "Tabla & Tepsi Arabaları",
    sub: "Gastro Kap Tepsili Arabalar",
  },
  tray_trolleys: {
    main: "Tabla & Tepsi Arabaları",
    sub: "Tepsi Arabaları",
  },

  cutlery_units: { main: "Servis Hatları", sub: "Küver Ünitesi" },
  soup_units: { main: "Servis Hatları", sub: "Çorba Ünitesi" },
  hot_service_units: {
    main: "Servis Hatları",
    sub: "Sıcak Servis Ünitesi",
  },
  cold_service_units: {
    main: "Servis Hatları",
    sub: "Soğuk Servis Ünitesi",
  },
  neutral_service_units: {
    main: "Servis Hatları",
    sub: "Nötr Servis Ünitesi",
  },
  cashier_units: { main: "Servis Hatları", sub: "Kasa Ünitesi" },

  single_tier_service_shelves: {
    main: "Servis Rafları",
    sub: "Tek Katlı Servis Rafı",
  },
  double_tier_service_shelves: {
    main: "Servis Rafları",
    sub: "Çift Katlı Servis Rafı",
  },
  heated_double_tier_service_shelves: {
    main: "Servis Rafları",
    sub: "Çift Katlı Isıtmalı Servis Rafı",
  },

  oven_stands: { main: "Fırın Stantları", sub: "Fırın Standı" },
  pizza_oven_stands: {
    main: "Fırın Stantları",
    sub: "Pizza Fırını Standı",
  },
  equipment_stands: {
    main: "Fırın Stantları",
    sub: "Ekipman Standı",
  },

  cocktail_preparation_counters: {
    main: "Bar Tezgâhları",
    sub: "Kokteyl Hazırlama Tezgâhı",
  },
  coffee_preparation_counters: {
    main: "Bar Tezgâhları",
    sub: "Kahve Hazırlama Tezgâhı",
  },

  bread_cabinets: { main: "Dolaplar", sub: "Ekmek Dolabı" },
  storage_cabinets: { main: "Dolaplar", sub: "Depolama Dolabı" },

  wall_type_hoods: {
    main: "Aspiratör & Aydınlatma Sistemleri",
    sub: "Duvar Tipi Davlumbuz",
  },
  island_type_hoods: {
    main: "Aspiratör & Aydınlatma Sistemleri",
    sub: "Ada Tipi Davlumbaz",
  },
  hood_shelves: {
    main: "Aspiratör & Aydınlatma Sistemleri",
    sub: "Aspiratör Rafı",
  },
  hood_lighting: {
    main: "Aspiratör & Aydınlatma Sistemleri",
    sub: "Aspiratör Aydınlatması",
  },
};
