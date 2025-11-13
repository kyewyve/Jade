(() => {
  const CONFIG = {
    STYLE_ID: "regalia.icon-style",
    MODAL_ID: "regalia.icon-modal",
    DATASTORE_KEY: "regalia.icon-datastore",
    API_URL: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/summoner-icons.json",
    CACHE_KEY: "regalia.icons-cache",
    CACHE_TIMEOUT: 24 * 60 * 60 * 1000
  };

  let currentIconSearchQuery = "";
  let iconSearchTimeout = null;

  function StopTimeProp(object, properties) {
    if (!object) return;
    for (const type in object) {
      if (
        (properties && properties.length && properties.includes(type)) ||
        !properties ||
        !properties.length
      ) {
        let value = object[type];
        try {
          Object.defineProperty(object, type, {
            configurable: false,
            get: () => value,
            set: (v) => v,
          });
        } catch {}
      }
    }
  }

  function replaceIconBackground() {
    function findAndReplaceIcon(element) {
      if (!element) return false;
      
      let found = false;
      
      if (element.shadowRoot) {
        const iconElement = element.shadowRoot.querySelector('.lol-regalia-summoner-icon');
        if (iconElement && iconElement.style.backgroundImage) {
          iconElement.style.backgroundImage = 'var(--custom-avatar)';
          found = true;
        }
        
        const shadowChildren = element.shadowRoot.querySelectorAll('*');
        shadowChildren.forEach(child => {
          if (findAndReplaceIcon(child)) {
            found = true;
          }
        });
      }
      
      return found;
    }
    
    function applyReplacement() {
      const customizerElement = document.querySelector('lol-regalia-identity-customizer-element');
      if (!customizerElement) {
        return false;
      }
      
      const crestElement = customizerElement.shadowRoot?.querySelector('lol-regalia-crest-v2-element');
      if (!crestElement) {
        return false;
      }
      
      return findAndReplaceIcon(crestElement);
    }
    
    const success = applyReplacement();
    return success;
  }

  function observeIconChanges() {
    const observer = new MutationObserver((mutations) => {
      let shouldReplace = false;
      
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'LOL-REGALIA-IDENTITY-CUSTOMIZER-ELEMENT' || 
                node.querySelector('lol-regalia-identity-customizer-element')) {
              shouldReplace = true;
              break;
            }
          }
        }
        
        if (shouldReplace) break;
      }
      
      if (shouldReplace) {
        setTimeout(() => {
          replaceIconBackground();
        }, 100);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    return observer;
  }

  function checkTabVisibility() {
    const tabComponent = document.querySelector('.identity-customizer-tab-icons-component');
    const isVisible = tabComponent && tabComponent.offsetParent !== null;
    return isVisible;
  }

  function initIconReplacement() {
    if (checkTabVisibility()) {
      setTimeout(() => {
        replaceIconBackground();
      }, 100);
    }
    
    const visibilityObserver = new MutationObserver(() => {
      if (checkTabVisibility()) {
        setTimeout(() => {
          replaceIconBackground();
        }, 100);
      }
    });
    
    const domObserver = observeIconChanges();
    
    const intervalId = setInterval(() => {
      if (checkTabVisibility()) {
        replaceIconBackground();
      }
    }, 100);
    
    return {
      stop: () => {
        visibilityObserver.disconnect();
        domObserver.disconnect();
        clearInterval(intervalId);
      }
    };
  }

  const iconReplacer = initIconReplacement();

  setTimeout(() => {
    replaceIconBackground();
  }, 100);

  class RegaliaIcon {
    constructor() {
      this.summonerId = null;
      this.puuid = null;
      this.observer = null;
      this.buttonCreated = false;
      this.customButton = null;
      this.iconInterval = null;
      this.iconTimeouts = [];
      this.currentIconId = null;
      this.iconsData = null;
      this.init();
    }

    async init() {
      try {
        try {
          const res = await fetch("/lol-summoner/v1/current-summoner");
          const data = await res.json();
          this.summonerId = data.summonerId;
          this.puuid = data.puuid;
        } catch (e) {}

        this.applyCustomIcon();
        this.IconContainerObserver();
      } catch (error) {}
    }

    getCachedIcons() {
      if (!window.DataStore) return null;
      
      const cached = window.DataStore.get(CONFIG.CACHE_KEY);
      if (!cached) return null;
      
      const { data, timestamp } = cached;
      if (Date.now() - timestamp > CONFIG.CACHE_TIMEOUT) {
        return null;
      }
      
      return data;
    }

    cacheIcons(icons) {
      if (window.DataStore) {
        window.DataStore.set(CONFIG.CACHE_KEY, {
          data: icons,
          timestamp: Date.now()
        });
      }
    }

    async loadIconsData() {
      const cached = this.getCachedIcons();
      if (cached) {
        this.iconsData = cached;
        return;
      }

      try {
        const response = await fetch(CONFIG.API_URL);
        const icons = await response.json();
        
        const validIcons = icons.filter((icon) => icon.id !== -1);
        this.iconsData = validIcons;
        
        this.cacheIcons(validIcons);
      } catch (error) {
        this.iconsData = [];
      }
    }
	
	IconContainerObserver() {
		const checkInterval = setInterval(() => {
			const isIconVisible = this.isIconContainerVisible();
			
			if (isIconVisible) {
				if (!this.buttonCreated) {
					this.customButton = this.createIconButton();
					this.customButton.addEventListener('click', () => this.showIconModal());
					this.buttonCreated = true;
				}
			} else {
				if (this.buttonCreated && this.customButton) {
					document.body.removeChild(this.customButton);
					this.customButton = null;
					this.buttonCreated = false;
				}
			}
		}, 250);
	}
	
	isIconContainerVisible() {
        const IconContainer = document.querySelector('.identity-customizer-icon-header');
        return IconContainer && IconContainer.offsetParent !== null;
    }
	
    createIconButton() {
        const button = document.createElement('button');
        
        const img = document.createElement('img');
		img.src = '/fe/lol-uikit/images/icon_settings.png'
		img.style.width = '15px';
        img.style.height = '15px';
        img.style.display = 'block';
        
        button.appendChild(img);
        button.style.position = 'fixed';
        button.style.bottom = '515px';
        button.style.right = '350px';
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

    revertIcon() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      if (this.iconInterval) {
        clearInterval(this.iconInterval);
        this.iconInterval = null;
      }
      if (this.iconTimeouts) {
        this.iconTimeouts.forEach(timeout => clearTimeout(timeout));
        this.iconTimeouts = [];
      }
      const styleElement = document.getElementById(CONFIG.STYLE_ID);
      if (styleElement) {
        styleElement.remove();
      }
      this.currentIconId = null;
    }

    async applyCustomIcon() {
      this.revertIcon();
      const selectedId = await window.DataStore.get(CONFIG.DATASTORE_KEY);

      if (!selectedId) {
        return;
      }

      this.currentIconId = selectedId;

      const iconUrl = `/lol-game-data/assets/v1/profile-icons/${selectedId}.jpg`;

      const style = document.createElement("style");
      style.id = CONFIG.STYLE_ID;
      style.innerHTML = `
        :root { --custom-avatar: url("${iconUrl}"); }
        .top > .icon-image.has-icon, summoner-icon {
          content: var(--custom-avatar) !important;
        }
        .lol-regalia-summoner-icon {
          background-image: var(--custom-avatar) !important;
        }
      `;
      document.head.appendChild(style);

      const applyIcons = () => {
        if (this.currentIconId !== selectedId) return;

        const updateAndFreezeIcon = (element) => {
          const iconElement = element.shadowRoot
            ?.querySelector("lol-regalia-crest-v2-element")
            ?.shadowRoot?.querySelector(".lol-regalia-summoner-icon");
          if (iconElement) {
            iconElement.style.backgroundImage = "var(--custom-avatar)";
            StopTimeProp(iconElement.style, ["backgroundImage"]);
            return;
          }

          if (element.tagName === "LOL-REGALIA-CREST-V2-ELEMENT") {
            const crestIcon = element.shadowRoot?.querySelector(
              ".lol-regalia-summoner-icon"
            );
            if (crestIcon) {
              crestIcon.style.backgroundImage = "var(--custom-avatar)";
              StopTimeProp(crestIcon.style, ["backgroundImage"]);
            }
          }
        };

        const regaliaIcons = document.querySelectorAll('.lol-regalia-summoner-icon');
        regaliaIcons.forEach(icon => {
          icon.style.backgroundImage = "var(--custom-avatar)";
          StopTimeProp(icon.style, ["backgroundImage"]);
        });

        const selectors = [
          `lol-regalia-hovercard-v2-element[summoner-id="${this.summonerId}"]`,
          `lol-regalia-profile-v2-element[summoner-id="${this.summonerId}"]`,
          `lol-regalia-parties-v2-element[summoner-id="${this.summonerId}"]`,
          `lol-regalia-crest-v2-element[voice-puuid="${this.puuid}"]`,
        ];
        const combinedSelector = selectors.join(", ");

        const existingElements = document.querySelectorAll(combinedSelector);
        existingElements.forEach(updateAndFreezeIcon);
      };

      applyIcons();

      const delays = [200, 500, 1000, 2000];
      this.iconTimeouts = delays.map(delay => 
        setTimeout(() => {
          if (this.currentIconId === selectedId) {
            applyIcons();
          }
        }, delay)
      );

      this.iconInterval = setInterval(() => {
        if (this.currentIconId === selectedId) {
          applyIcons();
        }
      }, 2000);

      this.observeDOM();
    }

    observeDOM() {
      const updateAndFreezeIcon = (element) => {
        const iconElement = element.shadowRoot
          ?.querySelector("lol-regalia-crest-v2-element")
          ?.shadowRoot?.querySelector(".lol-regalia-summoner-icon");
        if (iconElement) {
          iconElement.style.backgroundImage = "var(--custom-avatar)";
          StopTimeProp(iconElement.style, ["backgroundImage"]);
          return;
        }

        if (element.tagName === "LOL-REGALIA-CREST-V2-ELEMENT") {
          const crestIcon = element.shadowRoot?.querySelector(
            ".lol-regalia-summoner-icon"
          );
          if (crestIcon) {
            crestIcon.style.backgroundImage = "var(--custom-avatar)";
            StopTimeProp(crestIcon.style, ["backgroundImage"]);
          }
        }

        if (element.classList && element.classList.contains('lol-regalia-summoner-icon')) {
          element.style.backgroundImage = "var(--custom-avatar)";
          StopTimeProp(element.style, ["backgroundImage"]);
        }
      };

      const selectors = [
        `lol-regalia-hovercard-v2-element[summoner-id="${this.summonerId}"]`,
        `lol-regalia-profile-v2-element[summoner-id="${this.summonerId}"]`,
        `lol-regalia-parties-v2-element[summoner-id="${this.summonerId}"]`,
        `lol-regalia-crest-v2-element[voice-puuid="${this.puuid}"]`,
        '.lol-regalia-summoner-icon'
      ];
      const combinedSelector = selectors.join(", ");

      this.observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node instanceof Element) {
              if (node.matches(combinedSelector)) {
                updateAndFreezeIcon(node);
              }
              const matchingElements = node.querySelectorAll(combinedSelector);
              if (matchingElements.length > 0) {
                matchingElements.forEach(updateAndFreezeIcon);
              }
            }
          }
        }
      });

      this.observer.observe(document.body, { childList: true, subtree: true });
      const existingElements = document.querySelectorAll(combinedSelector);
      existingElements.forEach(updateAndFreezeIcon);
    }

	async showIconModal() {
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
	  reminder.style.padding = '10px'
	  reminder.style.marginRight = '30px';
	  reminder.style.marginBottom = '0px';
	  reminder.textContent = 'REMEMBER: ONLY YOU CAN SEE CHANGES';
	  reminder.className = 'soft-text-glow';

	  content.appendChild(reminder);

      const searchContainer = document.createElement('div');
      searchContainer.style.position = 'absolute';
      searchContainer.style.top = '15px';
      searchContainer.style.left = '15px';
      searchContainer.style.zIndex = '10001';

      const searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.placeholder = 'Search...';
      searchInput.className = 'search-input';
      searchInput.addEventListener('input', (e) => {
        this.filterTitles(e.target.value);
      });

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
        currentIconSearchQuery = '';
		document.body.removeChild(modal);
	  };
	  
	  closeBtn.addEventListener('click', closeModal);
	  
	  const listContainer = document.createElement('div');
	  listContainer.style.flex = '1';
	  listContainer.style.overflowY = 'auto';
	  listContainer.style.overflowX = 'hidden';
	  listContainer.style.marginTop = '0px';
	  listContainer.style.paddingRight = '10px';
			
	  const list = document.createElement('div');
	  list.style.display = 'grid';
	  list.style.gridTemplateColumns = 'repeat(auto-fill, minmax(120px, 1fr))';
	  list.style.gap = '15px';
	  list.style.width = '100%';
	  list.style.marginTop = '10px';
	  list.style.boxSizing = 'border-box';

	  listContainer.appendChild(list);
	  content.appendChild(closeBtn);
	  content.appendChild(listContainer);
	  modal.appendChild(content);
	  document.body.appendChild(modal);

	  listContainer.className = 'jade-scrollable';

	  this.loadIconsIntoModal(list, modal, searchInput);

      searchInput.addEventListener('input', () => {
        if (iconSearchTimeout) {
          clearTimeout(iconSearchTimeout);
        }
        
        iconSearchTimeout = setTimeout(() => {
          currentIconSearchQuery = searchInput.value.toLowerCase().trim();
          this.loadIconsIntoModal(list, modal, searchInput);
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

    async loadIconsIntoModal(list, modal, searchInput) {
	  try {
        if (!this.iconsData) {
          await this.loadIconsData();
        }
		
		list.innerHTML = '';

		const validIcons = [];
		const currentIconId = await window.DataStore.get(CONFIG.DATASTORE_KEY);
		
		let filteredIcons = this.iconsData;
        
        if (currentIconSearchQuery) {
          filteredIcons = filteredIcons.filter(icon => 
            icon && icon.title && icon.title.toLowerCase().includes(currentIconSearchQuery)
          );
        }

        const sortedIcons = filteredIcons.sort((a, b) => b.id - a.id);
		
		const iconPromises = sortedIcons.slice(0, 200).map((icon) => {
		  return new Promise((resolve) => {
			const img = new Image();
			img.onload = () => {
			  validIcons.push({ 
				...icon, 
				element: img
			  });
			  resolve();
			};
			img.onerror = () => {
			  resolve();
			};
			img.src = `/lol-game-data/assets/v1/profile-icons/${icon.id}.jpg`;
			img.style.width = '100%';
			img.style.height = '100%';
			img.style.objectFit = 'cover';
			img.style.borderRadius = '4px';
			img.style.boxSizing = 'border-box';
		  });
		});

		await Promise.all(iconPromises);

		if (validIcons.length === 0) {
		  list.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
              <p style="color: #728581; font-size: 16px; margin: 0;">
                ${this.iconsData ? 'No icons found matching your search.' : 'Loading icons...'}
              </p>
            </div>
          `;
		  return;
		}

		validIcons.forEach(icon => {
		  const item = document.createElement('div');
		  item.style.padding = '10px';
		  item.style.backgroundColor = '#21211F';
		  item.style.borderRadius = '8px';
		  item.style.cursor = 'pointer';
		  item.style.border = '2px solid transparent';
		  item.style.display = 'flex';
		  item.style.flexDirection = 'column';
		  item.style.alignItems = 'center';
		  item.style.gap = '8px';
		  item.style.zIndex = '1';
		  item.style.boxSizing = 'border-box';
		  
		  const iconImg = icon.element.cloneNode(true);
		  
		  if (icon.id === currentIconId) {
			iconImg.classList.add('selected-item-img');
			item.classList.add('selected-item-border');
		  }
		  
		  iconImg.addEventListener('mouseenter', () => {
			if (icon.id !== currentIconId) {
			  iconImg.style.animation = 'scaleUp 1s ease forwards';
			}
		  });

		  iconImg.addEventListener('mouseleave', () => {
			if (icon.id !== currentIconId) {
			  iconImg.style.animation = 'scaleDown 0.5s ease forwards';
			}
		  });
		  
		  item.addEventListener('mouseenter', () => {
			if (icon.id !== currentIconId) {
			  item.style.animation = 'BorderColorUp 1s ease forwards';
			}
		  });
		  
		  item.addEventListener('mouseleave', () => {
			if (icon.id !== currentIconId) {
			  item.style.animation = 'BorderColorDown 0.5s ease forwards';
			}
		  });
		  
		  item.addEventListener('click', async () => {
			await window.DataStore.set(CONFIG.DATASTORE_KEY, icon.id);
			await this.applyCustomIcon();
			currentIconSearchQuery = '';
			document.body.removeChild(modal);
		  });
		  
		  item.appendChild(iconImg);
		  list.appendChild(item);
		});

	  } catch (error) {
		list.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px;"><p style="color: #e63946; font-size: 16px; margin: 0;">Failed to load icons. Please try again later.</p></div>';
	  }
	}
  }

  window.addEventListener("load", () => {
    window.RegaliaIcon = new RegaliaIcon();
  });
})();