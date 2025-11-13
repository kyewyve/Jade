(() => {
  const CONFIG = {
    STYLE_ID: "bgcm-button-style",
    BUTTON_ID: "bgcm-custom-button",
    MODAL_ID: "bgcm-modal"
  };

  let skinData = [];
  let previewGroups = [];
  let currentSearchQuery = "";
  let selectedSkinId = null;
  let searchTimeout = null;

  class BGCM {
    constructor() {
      this.buttonCreated = false;
      this.customButton = null;
      this.currentBackgroundType = 'image';
      this.dataLoaded = false;
      this.blurObserver = null;
      this.isChampionSelectActive = false;
      this.championSelectObserver = null;
      this.init();
    }

    init() {
      this.loadData();
      this.buttonContainerObserver();
      this.applyCustomBackground();
      this.setupChampionSelectObserver();
      
      if (window.DataStore) {
        selectedSkinId = window.DataStore.get('bgcm-selected-skin-id');
      }
    }

    setupChampionSelectObserver() {
      this.championSelectObserver = new MutationObserver((mutations) => {
        const championSelectElement = document.querySelector('.champion-select-main-container');
        
        if (championSelectElement && championSelectElement.offsetParent !== null) {
          if (!this.isChampionSelectActive) {
            this.isChampionSelectActive = true;
            this.disablePlugin();
          }
        } else {
          if (this.isChampionSelectActive) {
            this.isChampionSelectActive = false;
            this.enablePlugin();
          }
        }
      });

      this.championSelectObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
      });

      const initialCheck = document.querySelector('.champion-select-main-container');
      if (initialCheck && initialCheck.offsetParent !== null) {
        this.isChampionSelectActive = true;
        this.disablePlugin();
      }
    }

    disablePlugin() {
      this.removeCustomBackground();
      
      if (this.customButton && document.body.contains(this.customButton)) {
        this.customButton.remove();
        this.customButton = null;
        this.buttonCreated = false;
      }
      
      const modal = document.getElementById(CONFIG.MODAL_ID);
      if (modal) {
        modal.remove();
      }
    }

    enablePlugin() {
      this.applyCustomBackground();
      
      const isContainerVisible = this.isButtonContainerVisible();
      if (isContainerVisible && !this.buttonCreated) {
        this.customButton = this.createCustomButton();
        this.customButton.addEventListener('click', () => this.handleButtonClick());
        this.buttonCreated = true;
      }
    }

    async loadData() {
      try {
        const endpoints = [
          "https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/default/v1/skins.json",
          "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/skins.json",
          "/lol-game-data/assets/v1/skins.json"
        ];

        let skinsResponse = null;
        for (const endpoint of endpoints) {
          try {
            skinsResponse = await fetch(endpoint);
            if (skinsResponse.ok) break;
          } catch (e) {
            continue;
          }
        }

        if (!skinsResponse || !skinsResponse.ok) {
          return;
        }

        const skinsRaw = await skinsResponse.json();

        let skinsArray = [];
        if (Array.isArray(skinsRaw)) {
          skinsArray = skinsRaw;
        } else if (typeof skinsRaw === 'object') {
          skinsArray = this.extractSkinsFromObject(skinsRaw);
        }

        const uniqueSkins = new Map();
        skinsArray.forEach(skin => {
          if (skin && skin.id && !uniqueSkins.has(skin.id)) {
            uniqueSkins.set(skin.id, skin);
          }
        });
        
        skinData = Array.from(uniqueSkins.values()).flatMap(skin => this.processSkinData(skin));
        
        await this.loadTFTData();
        
        this.dataLoaded = true;

      } catch (error) {
        this.dataLoaded = true;
      }
    }

    extractSkinsFromObject(obj) {
      const skins = [];
      
      const traverse = (current) => {
        if (!current || typeof current !== 'object') return;
        
        if (current.id !== undefined && current.name !== undefined) {
          skins.push(current);
        }
        
        if (current.questSkinInfo && current.questSkinInfo.tiers) {
          current.questSkinInfo.tiers.forEach(tier => {
            if (tier && tier.id !== undefined && tier.name !== undefined) {
              skins.push(tier);
            }
          });
        }
        
        for (const key in current) {
          if (current.hasOwnProperty(key)) {
            const value = current[key];
            
            if (Array.isArray(value)) {
              value.forEach(item => {
                if (item && typeof item === 'object') {
                  traverse(item);
                }
              });
            } else if (typeof value === 'object' && value !== null) {
              traverse(value);
            }
          }
        }
      };
      
      traverse(obj);
      return skins;
    }

    async loadTFTData() {
      try {
        const tftEndpoints = [
          "https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/default/v1/tftrotationalshopitemdata.json",
          "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/tftrotationalshopitemdata.json"
        ];

        let tftResponse = null;
        for (const endpoint of tftEndpoints) {
          try {
            tftResponse = await fetch(endpoint);
            if (tftResponse.ok) break;
          } catch (e) {
            continue;
          }
        }

        if (!tftResponse || !tftResponse.ok) {
          return;
        }

        const tftRaw = await tftResponse.json();
        const tftArray = Array.isArray(tftRaw) ? tftRaw : [];

        const companionItems = tftArray
          .filter(item => 
            item && 
            item.descriptionTraKey &&
            item.descriptionTraKey.toLowerCase().startsWith("companion") &&
            item.backgroundTextureLCU
          )
          .map(item => this.processTFTItem(item));

        skinData.push(...companionItems);

      } catch (error) {}
    }

    processTFTItem(item) {
      const cleanPath = (path) => {
        if (!path) return "";
        return path
          .replace(/^ASSETS\//i, "")
          .toLowerCase();
      };

      const cleanBackgroundTexture = cleanPath(item.backgroundTextureLCU);
      const cleanLargeIcon = cleanPath(item.standaloneLoadoutsLargeIcon);

      return {
        id: `tft-${item.id || Math.random()}`,
        name: item.name || "TFT Companion",
        tilePath: cleanLargeIcon
          ? `https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/default/assets/${cleanLargeIcon}`
          : "",
        splashPath: cleanBackgroundTexture
          ? `https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/default/assets/${cleanBackgroundTexture}`
          : "",
        uncenteredSplashPath: cleanBackgroundTexture
          ? `https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/default/assets/${cleanBackgroundTexture}`
          : "",
        splashVideoPath: "",
        collectionSplashVideoPath: "",
        isAnimated: false,
        isTFT: true,
        skinLineId: null,
        skinLineName: null
      };
    }

    processSkinData(skin) {
      if (!skin) return [];

      const cleanPath = (path) => {
        if (!path) return "";
        return path
          .replace(/^\/lol-game-data\/assets\/ASSETS\//i, "")
          .toLowerCase();
      };

      const baseSkin = {
        ...skin,
        tilePath: cleanPath(skin.tilePath)
          ? `https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/default/assets/${cleanPath(skin.tilePath)}`
          : skin.tilePath || "/lol-game-data/assets/v1/profile-icons/1.jpg",
        splashPath: cleanPath(skin.splashPath)
          ? `https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/default/assets/${cleanPath(skin.splashPath)}`
          : skin.splashPath || skin.tilePath || "/lol-game-data/assets/v1/profile-icons/1.jpg",
        uncenteredSplashPath: cleanPath(skin.uncenteredSplashPath)
          ? `https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/default/assets/${cleanPath(skin.uncenteredSplashPath)}`
          : "",
        splashVideoPath: cleanPath(skin.splashVideoPath)
          ? `https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/default/assets/${cleanPath(skin.splashVideoPath)}`
          : "",
        collectionSplashVideoPath: cleanPath(skin.collectionSplashVideoPath)
          ? `https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/default/assets/${cleanPath(skin.collectionSplashVideoPath)}`
          : "",
        isAnimated: false,
        isTFT: false,
      };

      const skins = [baseSkin];

      if (skin.splashVideoPath || skin.collectionSplashVideoPath) {
        const videoPath = skin.splashVideoPath || skin.collectionSplashVideoPath;
        skins.push({
          ...skin,
          id: `${skin.id}-animated`,
          name: `${skin.name} (Animated)`,
          tilePath: baseSkin.tilePath,
          splashPath: cleanPath(videoPath)
            ? `https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/default/assets/${cleanPath(videoPath)}`
            : baseSkin.splashPath,
          uncenteredSplashPath: cleanPath(videoPath)
            ? `https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/default/assets/${cleanPath(videoPath)}`
            : "",
          splashVideoPath: cleanPath(videoPath)
            ? `https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/default/assets/${cleanPath(videoPath)}`
            : "",
          isAnimated: true,
          isTFT: false,
        });
      }

      return skins;
    }

    setCustomBackground(url, isAnimated = false, skinId = null) {
      if (this.isChampionSelectActive) return;
      
      this.removeCustomBackground();

      this.currentBackgroundType = isAnimated ? 'video' : 'image';

      if (isAnimated) {
        this.createVideoBackground(url);
      } else {
        this.createImageElementBackground(url);
      }
      
      if (window.DataStore) {
        window.DataStore.set('bgcm-selected-background', url);
        window.DataStore.set('bgcm-background-type', this.currentBackgroundType);
        if (skinId) {
          selectedSkinId = skinId;
          window.DataStore.set('bgcm-selected-skin-id', skinId);
        }
      }
    }

    updateBlur() {
      const profileInfo = document.querySelector('.style-profile-summoner-info-component');
      const shouldBlur = !(profileInfo && profileInfo.offsetParent !== null);
      
      const image = document.getElementById('bgcm-custom-image');
      const video = document.getElementById('bgcm-custom-video');
      
      if (image) image.style.filter = `blur(${shouldBlur ? '5px' : '0px'})`;
      if (video) video.style.filter = `blur(${shouldBlur ? '5px' : '0px'})`;
    }

    createImageElementBackground(url) {
      this.cleanupInlineStyles();

      const img = document.createElement('img');
      img.id = 'bgcm-custom-image';
      img.src = url;
      
      img.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        object-fit: cover;
        z-index: -1;
        pointer-events: none;
		transition: filter 0.5s ease-in-out;
      `;

      this.updateBlur();
      
      this.blurObserver = new MutationObserver(() => {
        this.updateBlur();
      });
      
      this.blurObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
      });

      document.body.appendChild(img);

      const style = document.createElement('style');
      style.id = 'bgcm-custom-style';
      style.textContent = `
        lol-uikit-background-switcher-image,
        .lol-uikit-background-switcher-image,
        [class*="background-switcher"],
        [src*="parties-background"],
        [src*="background"] {
          display: none !important;
          visibility: hidden !important;
        }

        #bgcm-custom-image {
          display: block !important;
          visibility: visible !important;
        }

        #bgcm-custom-video {
          display: none !important;
        }
      `;
      
      document.head.appendChild(style);
    }

    createVideoBackground(url) {
      this.cleanupInlineStyles();

      const video = document.createElement('video');
      video.id = 'bgcm-custom-video';
      video.src = url;
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      
      video.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        object-fit: cover;
        z-index: -1;
        pointer-events: none;
		transition: filter 0.5s ease-in-out;
      `;

      this.updateBlur();
      
      this.blurObserver = new MutationObserver(() => {
        this.updateBlur();
      });
      
      this.blurObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
      });

      video.onerror = () => {
        const imageUrl = url.replace('-animated', '').replace('(Animated)', '').trim();
        this.setCustomBackground(imageUrl, false);
      };

      document.body.appendChild(video);

      const style = document.createElement('style');
      style.id = 'bgcm-custom-style';
      style.textContent = `
        lol-uikit-background-switcher-image,
        .lol-uikit-background-switcher-image,
        [class*="background-switcher"],
        [src*="parties-background"],
        [src*="background"] {
          display: none !important;
          visibility: hidden !important;
        }

        #bgcm-custom-video {
          display: block !important;
          visibility: visible !important;
        }
      `;
      
      document.head.appendChild(style);
    }

    cleanupInlineStyles() {
      const selectors = [
        'lol-uikit-background-switcher-image',
        '.lol-uikit-background-switcher-image',
        '[class*="background"]',
        '[src*="parties-background"]',
        '[src*="background"]'
      ];

      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          element.style.backgroundImage = '';
          element.style.display = '';
          element.style.visibility = '';
        });
      });
    }

    removeCustomBackground() {
      const style = document.getElementById('bgcm-custom-style');
      if (style) {
        style.remove();
      }
      
      const video = document.getElementById('bgcm-custom-video');
      if (video) {
        video.remove();
      }
      
      const img = document.getElementById('bgcm-custom-image');
      if (img) {
        img.remove();
      }
      
      if (this.blurObserver) {
        this.blurObserver.disconnect();
        this.blurObserver = null;
      }
      
      this.cleanupInlineStyles();
    }

    applyCustomBackground() {
      if (this.isChampionSelectActive) return;
      
      const savedBackground = window.DataStore?.get('bgcm-selected-background');
      const backgroundType = window.DataStore?.get('bgcm-background-type') || 'image';
      
      if (savedBackground) {
        this.setCustomBackground(savedBackground, backgroundType === 'video');
      }
    }

    generatePreviewGroups() {
      previewGroups = [];

      if (!this.dataLoaded) {
        return;
      }

      const lolGroup = {
        title: "LoL Skins",
        items: []
      };
      
      const tftGroup = {
        title: "TFT Companions",
        items: []
      };
      
      skinData.forEach((skin) => {
        if (!skin || !skin.name) return;
        
        if (skin.isTFT) {
          tftGroup.items.push({
            id: skin.id || Math.random(),
            name: skin.name,
            tilePath: skin.tilePath,
            splashPath: skin.splashPath,
            uncenteredSplashPath: skin.uncenteredSplashPath,
            splashVideoPath: skin.splashVideoPath,
            skinLineId: null,
            skinLineName: null,
            isAnimated: skin.isAnimated,
            isTFT: true,
          });
        } else {
          lolGroup.items.push({
            id: skin.id || Math.random(),
            name: skin.name,
            tilePath: skin.tilePath,
            splashPath: skin.splashPath,
            uncenteredSplashPath: skin.uncenteredSplashPath,
            splashVideoPath: skin.splashVideoPath,
            skinLineId: null,
            skinLineName: null,
            isAnimated: skin.isAnimated,
            isTFT: false,
          });
        }
      });

      lolGroup.items.sort((a, b) => a.name.localeCompare(b.name));
      tftGroup.items.sort((a, b) => a.name.localeCompare(b.name));

      if (lolGroup.items.length > 0) {
        previewGroups.push(lolGroup);
      }
      
      if (tftGroup.items.length > 0) {
        previewGroups.push(tftGroup);
      }

      const customBackgrounds = window.DataStore?.get("customBackgrounds") || [];
      const customGroup = {
        title: "Custom Background",
        items: customBackgrounds.map((item, index) => ({
          id: `custom-${index}`,
          name: item.name,
          tilePath: item.tilePath,
          splashPath: item.splashPath,
          uncenteredSplashPath: item.uncenteredSplashPath,
          skinLineId: null,
          isTFT: false,
          isAnimated: item.isAnimated,
        })),
      };
      customGroup.items.sort((a, b) => a.name.localeCompare(b.name));
      previewGroups.push(customGroup);
    }

    buttonContainerObserver() {
      const checkInterval = setInterval(() => {
        if (this.isChampionSelectActive) return;
        
        const isContainerVisible = this.isButtonContainerVisible();
        
        if (isContainerVisible) {
          if (!this.buttonCreated) {
            this.customButton = this.createCustomButton();
            this.customButton.addEventListener('click', () => this.handleButtonClick());
            this.buttonCreated = true;
          }
        } else {
          if (this.buttonCreated && this.customButton) {
            if (document.body.contains(this.customButton)) {
              this.customButton.style.transition = 'opacity 0.2s ease';
              this.customButton.style.opacity = '0';
              setTimeout(() => {
                if (document.body.contains(this.customButton)) {
                  document.body.removeChild(this.customButton);
                }
              }, 200);
            }
            this.customButton = null;
            this.buttonCreated = false;
          }
        }
      }, 250);
    }

    isButtonContainerVisible() {
      const container = document.querySelector('.lol-social-sidebar');
      return container && container.offsetParent !== null;
    }

    createCustomButton() {
      const button = document.createElement('button');
      button.id = CONFIG.BUTTON_ID;
      
      const img = document.createElement('img');
      img.src = '/fe/lol-uikit/images/icon_settings.png';
      img.style.width = '15px';
      img.style.height = '15px';
      img.style.display = 'block';
      
      button.appendChild(img);
      button.style.position = 'absolute';
      button.style.top = '10px';
      button.style.right = '200px';
      button.style.zIndex = '9999';
      button.style.padding = '5px';
      button.style.backgroundColor = '#1e292c';
      button.style.border = '2px solid #81602b';
      button.style.borderRadius = '50%';
      button.style.cursor = 'pointer';
      button.style.width = '20px';
      button.style.height = '20px';
      button.style.display = 'flex';
      button.style.alignItems = 'center';
      button.style.justifyContent = 'center';
      button.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
      button.style.transition = 'all 0.3s ease';
      button.style.opacity = '0';
      
      document.body.appendChild(button);
      
      setTimeout(() => {
        button.style.transition = 'opacity 0.2s ease, all 0.3s ease';
        button.style.opacity = '1';
      }, 10);
      
      button.addEventListener('mouseenter', () => {
        button.style.backgroundColor = '#253236';
        button.style.transform = 'scale(1.1)';
        button.style.boxShadow = '0 4px 15px rgba(0,0,0,0.4)';
      });
      
      button.addEventListener('mouseleave', () => {
        button.style.backgroundColor = '#1e292c';
        button.style.transform = 'scale(1)';
        button.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
      });
      
      return button;
    }

    handleButtonClick() {
      if (this.isChampionSelectActive) return;
      this.showModal();
    }

    showModal() {
      document.getElementById(CONFIG.MODAL_ID)?.remove();

      const modal = document.createElement('div');
      modal.id = CONFIG.MODAL_ID;
      modal.style.position = 'fixed';
      modal.style.top = '0';
      modal.style.left = '0';
      modal.style.width = '100%';
      modal.style.height = '100%';
      modal.style.backgroundColor = 'rgba(0,0,0,0.8)';
      modal.style.zIndex = '10000';
      modal.style.display = 'flex';
      modal.style.alignItems = 'center';
      modal.style.justifyContent = 'center';
      
      const signature = document.createElement('div');
      signature.style.position = 'absolute';
      signature.style.bottom = '10px';
      signature.style.right = '10px';
      signature.style.backgroundColor = 'transparent';
      signature.style.color = '#3a6158';
      signature.style.fontSize = '9px';
      signature.style.fontWeight = 'bold';
      signature.style.fontFamily = 'Montserrat, sans-serif';
      signature.style.textAlign = 'right';
      signature.style.padding = '5px';
      signature.style.zIndex = '10001';
      signature.style.pointerEvents = 'none';
      signature.textContent = 'by @kyewyve';
      modal.appendChild(signature);
      
      const content = document.createElement('div');
      content.style.backgroundColor = '#131312';
      content.style.padding = '10px';
      content.style.borderRadius = '15px';
      content.style.maxWidth = '1200px';
      content.style.width = '80%';
      content.style.maxHeight = '600px';
      content.style.height = '100%';
      content.style.overflow = 'hidden';
      content.style.boxShadow = '0 0 30px rgba(0,0,0,0.7)';
      content.style.position = 'relative';
      content.style.boxSizing = 'border-box';
      content.style.display = 'flex';
      content.style.flexDirection = 'column';

      const logoUrl = 'https://plugins/Jade/assets/logo.png';
      const testImg = new Image();
      testImg.onload = () => {
        const logoBackground = document.createElement('div');
        logoBackground.style.position = 'absolute';
        logoBackground.style.top = '0';
        logoBackground.style.left = '0';
        logoBackground.style.width = '100%';
        logoBackground.style.height = '100%';
        logoBackground.style.backgroundImage = `url('${logoUrl}')`;
        logoBackground.style.backgroundSize = '600px';
        logoBackground.style.backgroundRepeat = 'no-repeat';
        logoBackground.style.backgroundPosition = '-70px -70px';
        logoBackground.style.zIndex = '0';
        logoBackground.style.pointerEvents = 'none';
        logoBackground.style.animation = 'logoGlow 3s ease-in-out infinite alternate';
        logoBackground.style.transformOrigin = 'center center';
		logoBackground.style.opacity = '0.2';
        content.appendChild(logoBackground);
      };
      testImg.src = logoUrl;

      const reminder = document.createElement('div');
      reminder.style.color = '#3a6158';
      reminder.style.fontSize = '9px';
      reminder.style.fontWeight = 'bold';
      reminder.style.fontFamily = 'Montserrat, sans-serif';
      reminder.style.textAlign = 'right';
      reminder.style.padding = '10px';
      reminder.style.marginRight = '30px';
      reminder.style.marginBottom = '0px';
      reminder.textContent = 'REMEMBER: ONLY YOU CAN SEE CHANGES';
      reminder.className = 'soft-text-glow';
      content.appendChild(reminder);

      const searchContainer = document.createElement('div');
      searchContainer.style.display = 'flex';
      searchContainer.style.gap = '15px';
      searchContainer.style.padding = '10px 20px';
      searchContainer.style.alignItems = 'center';

      const searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.placeholder = 'Search skins...';
      searchInput.style.flex = '1';
      searchInput.style.padding = '8px 12px';
      searchInput.style.backgroundColor = '#1e2328';
      searchInput.style.border = '1px solid #1d4f44';
      searchInput.style.borderRadius = '4px';
      searchInput.style.color = '#728581';
      searchInput.style.fontFamily = 'Montserrat, sans-serif';
      searchInput.style.fontSize = '14px';
      searchInput.style.opacity = '1';

      searchContainer.appendChild(searchInput);
      content.appendChild(searchContainer);
      
      const closeBtn = document.createElement('button');
      closeBtn.style.position = 'absolute';
      closeBtn.style.top = '15px';
      closeBtn.style.right = '15px';
      closeBtn.style.width = '16px';
      closeBtn.style.height = '16px';
      closeBtn.style.backgroundColor = '#28423d';
      closeBtn.style.borderRadius = '50%';
      closeBtn.style.border = 'none';
      closeBtn.style.cursor = 'pointer';
      closeBtn.style.display = 'flex';
      closeBtn.style.alignItems = 'center';
      closeBtn.style.justifyContent = 'center';
      
      closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.animation = 'ColorUp 0.3s forwards';
      });

      closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.animation = 'ColorDown 0.25s forwards';
      });
      
      const closeModal = () => {
        searchInput.value = '';
        currentSearchQuery = '';
        document.body.removeChild(modal);
      };
      
      closeBtn.addEventListener('click', closeModal);
      
      const listContainer = document.createElement('div');
      listContainer.style.flex = '1';
      listContainer.style.overflowY = 'auto';
      listContainer.style.overflowX = 'hidden';
      listContainer.style.marginTop = '0px';
      listContainer.style.paddingRight = '15px';
      
      const scrollbarStyle = document.createElement('style');
      scrollbarStyle.textContent = `
        .bgcm-scrollable::-webkit-scrollbar {
          width: 8px;
        }
        .bgcm-scrollable::-webkit-scrollbar-track {
          background: transparent;
          border-radius: 10px;
          margin: 5px;
        }
        .bgcm-scrollable::-webkit-scrollbar-thumb {
          background: #28423d;
          border-radius: 10px;
          border: 2px solid transparent;
        }
        
        .skin-item.selected {
          border: 2px solid #4b7d6f !important;
          box-shadow: 0 0 10px rgba(68, 194, 164, 0.5) !important;
          animation: smoothGlow 2s ease-in-out infinite alternate !important;
        }
        
        .skin-item.selected img {
          filter: grayscale(100%) !important;
          transform: scale(1.05) !important;
        }
      `;
      document.head.appendChild(scrollbarStyle);
          
      const list = document.createElement('div');
      list.style.display = 'grid';
      list.style.gridTemplateColumns = 'repeat(auto-fill, minmax(120px, 1fr))';
      list.style.gap = '15px';
      list.style.width = '100%';
      list.style.boxSizing = 'border-box';

      listContainer.appendChild(list);
      content.appendChild(closeBtn);
      content.appendChild(listContainer);
      modal.appendChild(content);
      document.body.appendChild(modal);

      listContainer.className = 'bgcm-scrollable';

      this.loadSkinsIntoModal(list, modal, searchInput);

      searchInput.addEventListener('input', () => {
        if (searchTimeout) {
          clearTimeout(searchTimeout);
        }
        
        searchTimeout = setTimeout(() => {
          currentSearchQuery = searchInput.value.toLowerCase().trim();
          this.loadSkinsIntoModal(list, modal, searchInput);
        }, 500);
      });

      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeModal();
        }
      });
      
      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          closeModal();
          document.removeEventListener('keydown', handleEscape);
        }
      };
      document.addEventListener('keydown', handleEscape);
      
      modal.addEventListener('DOMNodeRemoved', () => {
        document.removeEventListener('keydown', handleEscape);
      });
    }

    async loadSkinsIntoModal(list, modal, searchInput) {
      try {
        this.generatePreviewGroups();
        
        list.innerHTML = '';

        const validItems = [];
        const processedIds = new Set();
        
        previewGroups.forEach(group => {
          let groupItems = group.items;
          
          if (currentSearchQuery) {
            groupItems = groupItems.filter(item => 
              item && item.name && item.name.toLowerCase().includes(currentSearchQuery)
            );
          }

          groupItems.forEach(item => {
            if (item && item.tilePath && !processedIds.has(item.id)) {
              processedIds.add(item.id);
              validItems.push({
                ...item,
                element: null,
                isSelected: item.id === selectedSkinId,
                groupTitle: group.title
              });
            }
          });
        });

        if (validItems.length === 0) {
          list.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
              <p style="color: #728581; font-size: 16px; margin: 0;">
                ${this.dataLoaded ? 'No skins found matching your search.' : 'Loading skins...'}
              </p>
            </div>
          `;
          return;
        }

        const imagePromises = validItems.map(item => {
          return new Promise((resolve) => {
            const img = new Image();
            const timeout = setTimeout(() => {
              resolve();
            }, 5000);
            
            img.onload = () => {
              clearTimeout(timeout);
              item.element = img;
              resolve();
            };
            img.onerror = () => {
              clearTimeout(timeout);
              resolve();
            };
            img.src = item.tilePath;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '4px';
            img.style.boxSizing = 'border-box';
          });
        });

        await Promise.all(imagePromises);

        validItems.forEach(item => {
          if (!item.element) {
            return;
          }

          const itemElement = document.createElement('div');
          itemElement.className = 'skin-item';
          if (item.isSelected) {
            itemElement.classList.add('selected');
          }
          itemElement.style.padding = '10px';
          itemElement.style.backgroundColor = '#21211F';
          itemElement.style.borderRadius = '8px';
          itemElement.style.cursor = 'pointer';
          itemElement.style.border = item.isSelected ? '2px solid #4b7d6f' : '2px solid transparent';
          itemElement.style.display = 'flex';
          itemElement.style.flexDirection = 'column';
          itemElement.style.alignItems = 'center';
          itemElement.style.gap = '8px';
          itemElement.style.zIndex = '1';
          itemElement.style.boxSizing = 'border-box';
          itemElement.style.position = 'relative';
          itemElement.style.transition = 'all 0.3s ease';
          
          if (item.isAnimated) {
            const animationBadge = document.createElement('div');
            animationBadge.textContent = 'ANIMATED';
            animationBadge.style.position = 'absolute';
			animationBadge.style.fontFamily = 'var(--font-display)';
            animationBadge.style.top = '5px';
            animationBadge.style.left = '5px';
            animationBadge.style.color = '#010a13';
            animationBadge.style.padding = '2px 6px';
            animationBadge.style.borderRadius = '4px';
            animationBadge.style.fontSize = '10px';
            animationBadge.style.fontWeight = 'bold';
            animationBadge.style.zIndex = '2';
			animationBadge.style.background = 'linear-gradient(45deg, #287861, #6ec8ad)';
            itemElement.appendChild(animationBadge);
          }
          
          if (item.isTFT) {
            const tftBadge = document.createElement('div');
            tftBadge.textContent = 'TFT';
            tftBadge.style.position = 'absolute';
			tftBadge.style.fontFamily = 'var(--font-display)';
            tftBadge.style.top = '5px';
            tftBadge.style.right = '5px';
            tftBadge.style.color = '#000';
            tftBadge.style.padding = '2px 6px';
            tftBadge.style.borderRadius = '4px';
            tftBadge.style.fontSize = '10px';
            tftBadge.style.fontWeight = 'bold';
            tftBadge.style.zIndex = '2';
			tftBadge.style.background = 'linear-gradient(45deg, #3f2878, #6e76c8)';
            itemElement.appendChild(tftBadge);
          } else {
            const lolBadge = document.createElement('div');
            lolBadge.textContent = 'LoL';
            lolBadge.style.position = 'absolute';
			lolBadge.style.fontFamily = 'var(--font-display)';
            lolBadge.style.top = '5px';
            lolBadge.style.right = '5px';
            lolBadge.style.color = '#000';
            lolBadge.style.padding = '2px 6px';
            lolBadge.style.borderRadius = '4px';
            lolBadge.style.fontSize = '10px';
            lolBadge.style.fontWeight = 'bold';
            lolBadge.style.zIndex = '2';
			lolBadge.style.background = 'linear-gradient(45deg, #785a28, #c8aa6e)';
            itemElement.appendChild(lolBadge);
          }
          
          const itemImg = item.element.cloneNode(true);
          if (item.isSelected) {
            itemImg.style.filter = 'grayscale(100%)';
            itemImg.style.transform = 'scale(1.05)';
          }
          
          itemImg.addEventListener('mouseenter', () => {
			  if (!itemElement.classList.contains('selected')) {
				itemImg.style.animation = 'scaleUp 1s ease forwards';
			  }
			});

			itemImg.addEventListener('mouseleave', () => {
			  if (!itemElement.classList.contains('selected')) {
				itemImg.style.animation = 'scaleDown 0.5s ease forwards';
			  }
			});

			itemElement.addEventListener('mouseenter', () => {
			  if (!itemElement.classList.contains('selected')) {
				itemElement.style.animation = 'BorderColorUp 1s ease forwards';
			  }
			});

			itemElement.addEventListener('mouseleave', () => {
			  if (!itemElement.classList.contains('selected')) {
				itemElement.style.animation = 'BorderColorDown 0.5s ease forwards';
			  }
			});
          
          itemElement.addEventListener('click', async () => {
            document.querySelectorAll('.skin-item').forEach(el => {
              el.classList.remove('selected');
              el.style.borderColor = 'transparent';
              el.style.animation = '';
              const img = el.querySelector('img');
              if (img) {
                img.style.filter = '';
                img.style.transform = '';
              }
            });
            
            itemElement.classList.add('selected');
            itemElement.style.borderColor = '#4b7d6f';
            itemImg.style.filter = 'grayscale(100%)';
            itemImg.style.transform = 'scale(1.05)';
            
            const backgroundUrl = item.isAnimated ? 
              (item.splashVideoPath || item.splashPath) : 
              (item.splashPath || item.uncenteredSplashPath || item.tilePath);
              
            this.setCustomBackground(backgroundUrl, item.isAnimated, item.id);
            
            setTimeout(() => {
              if (document.body.contains(modal)) {
                document.body.removeChild(modal);
              }
              currentSearchQuery = '';
            }, 500);
          });
          
          itemElement.appendChild(itemImg);
          list.appendChild(itemElement);
        });

      } catch (error) {
        list.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
            <p style="color: #e63946; font-size: 16px; margin: 0;">Failed to load skins.</p>
          </div>
        `;
      }
    }

    destroy() {
      if (this.customButton && document.body.contains(this.customButton)) {
        document.body.removeChild(this.customButton);
      }
      this.buttonCreated = false;
      this.customButton = null;
      
      if (this.blurObserver) {
        this.blurObserver.disconnect();
      }
      
      if (this.championSelectObserver) {
        this.championSelectObserver.disconnect();
      }
      
      if (searchTimeout) {
        clearTimeout(searchTimeout);
        searchTimeout = null;
      }
    }
  }

  window.addEventListener("load", () => {
    window.BGCM = new BGCM();
  });
})();