// Sistema de cache de imagens para pré-carregamento
const imageCache = {
    cache: new Map(),
    loadedImages: 0,
    totalImages: 0,
    onComplete: null,
    domContainer: null,

    initDomContainer: function () {
        if (!this.domContainer) {
            this.domContainer = document.createElement('div');
            this.domContainer.id = 'asset-cache';
            this.domContainer.style.cssText = `
                position: absolute;
                width: 0;
                height: 0;
                overflow: hidden;
                pointer-events: none;
                visibility: hidden;
                z-index: -9999;
            `;
            document.body.appendChild(this.domContainer);
        }
    },

    preloadImages: function (urls) {
        this.initDomContainer();

        return new Promise(async (resolve, reject) => {
            if (urls.length === 0) {
                resolve(true);
                return;
            }

            this.totalImages = urls.length;
            this.loadedImages = 0;

            const promises = urls.map(async url => {
                if (this.cache.has(url)) {
                    this.imageLoaded();
                    return;
                }

                try {
                    const img = new Image();
                    img.src = url;
                    await img.decode();

                    // Add to DOM to force retention
                    this.domContainer.appendChild(img);

                    this.cache.set(url, img);
                    this.imageLoaded();
                } catch (e) {
                    console.warn(`Falha ao decodificar imagem: ${url}`, e);
                    const img = new Image();
                    img.onload = () => {
                        this.domContainer.appendChild(img); // Add even on fallback
                        this.cache.set(url, img);
                        this.imageLoaded();
                    };
                    img.onerror = () => this.imageLoaded();
                    img.src = url;
                }
            });

            await Promise.all(promises);
            resolve(true);
        });
    },

    imageLoaded: function () {
        this.loadedImages++;
        if (this.loadedImages === this.totalImages) {
            console.log('✅ Todas as imagens foram carregadas e cacheadas no DOM!');
            if (this.onComplete) this.onComplete();
        }
    },

    getImage: function (url) {
        return this.cache.get(url);
    }
};

// Pré-carrega TODAS as imagens do jogo
async function preloadAllGameAssets() {
    console.log('🔵 Iniciando pré-carregamento de assets...');

    // Coleta todas as URLs únicas
    const allUrls = new Set();

    Object.values(ASSETS).forEach(asset => {
        if (Array.isArray(asset)) {
            asset.forEach(url => {
                if (url && typeof url === 'string') {
                    allUrls.add(url);
                }
            });
        } else if (typeof asset === 'string') {
            allUrls.add(asset);
        }
    });

    // Adiciona URLs das armas
    Object.values(WEAPONS).forEach(weapon => {
        if (weapon.animation) {
            weapon.animation.forEach(url => allUrls.add(url));
        }
        if (weapon.icon) allUrls.add(weapon.icon);
        if (weapon.chargeAnimation) {
            weapon.chargeAnimation.forEach(url => allUrls.add(url));
        }
    });

    const urlsArray = Array.from(allUrls);
    console.log(`🔵 Pré-carregando ${urlsArray.length} imagens...`);

    try {
        const success = await imageCache.preloadImages(urlsArray);
        if (success) {
            console.log('✅ Todos os assets foram pré-carregados!');

            // Opcional: Iniciar jogo após carregar
            if (window.gameReadyCallback) {
                window.gameReadyCallback();
            }
        }
    } catch (error) {
        console.error('❌ Erro ao pré-carregar assets:', error);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    // Inicia pré-carregamento
    preloadAllGameAssets();

    // Configuração de FPS fixo
    const FPS = 60;
    let lastFrameTime = 0;
    let frameInterval = 1000 / FPS;
    let accumulator = 0;

    // SISTEMA DE ESCALA PERFEITO - RESPONSIVO PARA TODAS AS TELAS
    // ===================================================================
    function adjustGameScale() {
        const gameContainer = document.getElementById('game-container');
        const gameScaler = document.getElementById('game-scaler');

        // Tamanho base do jogo (nunca muda)
        const BASE_WIDTH = 1366;
        const BASE_HEIGHT = 768;

        // Dimensões da janela
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        // Calcula a escala para CABER na tela (mantém proporção)
        const scaleX = windowWidth / BASE_WIDTH;
        const scaleY = windowHeight / BASE_HEIGHT;

        // Usa a MENOR escala para garantir que tudo caiba
        let scale = Math.min(scaleX, scaleY);

        // Limites para a escala (evita muito pequeno ou muito grande)
        const MIN_SCALE = 1.1;
        const MAX_SCALE = 1.0;

        scale = Math.max(MIN_SCALE, Math.min(scale, MAX_SCALE));

        // Aplica a escala
        gameContainer.style.transform = `scale(${scale})`;

        // Calcula as novas dimensões
        const scaledWidth = BASE_WIDTH * scale;
        const scaledHeight = BASE_HEIGHT * scale;

        // Centraliza perfeitamente
        gameScaler.style.width = `${scaledWidth}px`;
        gameScaler.style.height = `${scaledHeight}px`;

        // DEBUG (opcional)
        if (CONFIG.DEBUG_MODE) {
            console.log(`Window: ${windowWidth}x${windowHeight}, Scale: ${scale.toFixed(2)}, Scaled: ${scaledWidth}x${scaledHeight}`);
        }

        // Adicione isso no final do drawDebug()
        if (CONFIG.DEBUG_MODE) {
            console.log('Jogador:', {
                x: this.player.x.toFixed(1),
                y: this.player.y.toFixed(1),
                velX: this.player.velocityX.toFixed(1),
                velY: this.player.velocityY.toFixed(1),
                grounded: this.player.isGrounded
            });
        }
    }

    // Ajusta a escala inicial e em redimensionamentos
    window.addEventListener('resize', adjustGameScale);
    window.addEventListener('orientationchange', adjustGameScale);
    window.addEventListener('load', adjustGameScale);

    // Ajuste inicial
    setTimeout(adjustGameScale, 100);

    // ===================================================================
    // CONFIGURAÇÕES GERAIS E CONSTANTES DO JOGO
    // ===================================================================
    const CONFIG = {
        DEBUG_MODE: true,
        PLAYER_SPEED: 8, // Aumentado para compensar aceleração
        PLAYER_ACCELERATION: 1.5,
        PLAYER_FRICTION: 0.8,
        PLAYER_AIR_RESISTANCE: 0.95,
        PLAYER_HEALTH: 99,
        GRAVITY: 0.6,
        PLAYER_JUMP_FORCE: 16,
        PLAYER_JUMP_CUT: 0.5, // Fator de corte do pulo ao soltar botão
        COYOTE_TIME: 100, // ms
        JUMP_BUFFER: 150, // ms
        CAMERA_SMOOTHING: 0.5,
        INVULNERABILITY_DURATION: 2000,
        SPECIAL_CHARGE_MAX: 6,
        SPECIAL_DURATION: 4000,
        DEFENSE_KNOCKBACK: 15,
        GAME_WIDTH: 800,
        GAME_HEIGHT: 600
    };

    // ===================================================================
    // ASSETS DO JOGO
    // ===================================================================
    const ASSETS = {
        player_idle: ['./webp/I.png', './webp/I1.png', './webp/I2.png', './webp/I3.png', './webp/I4.png', './webp/I5.png', './webp/I6.png'],
        player_walk: [
            './webp/1.png', './webp/2.png', './webp/3.png', './webp/4.png',
            './webp/5.png', './webp/6.png', './webp/7.png', './webp/8.png',
            './webp/9.png', './webp/10.png', './webp/11.png', './webp/12.png',
            './webp/13.png', './webp/14.png', './webp/15.png'
        ],
        // Localize o objeto ASSETS e adicione esta linha:
player_run_shoot: [
    './webp/1c.png', './webp/2c.png', './webp/3c.png', './webp/4c.png',
    './webp/5c.png', './webp/6c.png', './webp/7c.png', './webp/8c.png',
    './webp/9c.png', './webp/10c.png', './webp/11c.png', './webp/12c.png',
    './webp/13c.png', './webp/14c.png', './webp/15c.png', './webp/16c.png'
],
        player_jump: ['./webp/p.png', './webp/p4.png', './webp/p8.png', './webp/p12.png', './webp/p16.png', './webp/p18.png'],
        player_crouch: ['./webp/b1.png', './webp/b2.png', './webp/b3.png', './webp/b4.png', './webp/b5.png', './webp/b6.png', './webp/b7.png', './webp/b8.png', './webp/b9.png', './webp/b10.png'],
        shield_normal: [
            './webp/esc.png', './webp/esc1.png', './webp/esc2.png',
            './webp/esc3.png', './webp/esc4.png', './webp/esc5.png',
            './webp/esc6.png', './webp/esc7.png', './webp/esc8.png', './webp/esc9.png', './webp/esc10.png', './webp/esc11.png'
        ],
        shield_crack: ['./webp/esc12.png', './webp/esc13.png', './webp/esc14.png', './webp/esc15.png', './webp/esc16.png',],
        enemy_dead: ['./webp/dinossauro_morto.webp'],
        player_attack_sword: [
            './webp/espada1.png', './webp/espada2.png', './webp/espada3.png'
        ],
        player_attack_bow_charge: ['./webp/chute.png'],
        player_attack_pistol: ['./webp/a1.png', './webp/a2.png', './webp/a3.png', './webp/a4.png', './webp/a5.png', './webp/a6.png', './webp/a7.png', './webp/a8.png', './webp/a9.png', './webp/a10.png', './webp/a11.png', './webp/a12.png'],
        player_block: ['./webp/defesa.webp'],
        player_special: ['https://i.imgur.com/L127z5k.gif'],
        enemy_walk: ['./webp/d.png', './webp/d1.png', './webp/d2.png', './webp/d3.png', './webp/d4.png', './webp/d5.png', './webp/d6.png', './webp/d7.png', './webp/d8.png', './webp/d9.png', './webp/d10.png', './webp/d11.png', './webp/d12.png', './webp/d13.png', './webp/d14.png',],
        enemy_fly: ['./webp/fly.webp'],
        pickup_bow: './webp/pedra.webp',
        pickup_pistol: './webp/tiro.gif',
        projectile_arrow: './webp/pedra.webp',
        projectile_bullet: './webp/tiro.gif',
        icon_sword: './webp/espada.webp',
        icon_bow: './webp/pedra.webp',
        icon_pistol: './webp/tiro.gif',
        // Adicione ao seu objeto ASSETS
// Boss Assets - Certifique-se que esses arquivos existem na pasta webp
    boss_activate: ['./webp/monstro_ativo.png', './webp/monstro_ativo1.png', './webp/monstro_ativo2.png'], 
    boss_idle: [
        './webp/mloop.png', './webp/mloop2.png', './webp/mloop3.png', './webp/mloop4.png',
        './webp/mloop5.png', './webp/mloop6.png', './webp/mloop7.png', './webp/mloop8.png'
    ],
    boss_attack1: [
        './webp/ataque.png', './webp/ataque1.png', './webp/ataque2.png', './webp/ataque3.png', './webp/ataque4.png',
        './webp/ataque5.png', './webp/ataque6.png', './webp/ataque7.png', './webp/ataque8.png', './webp/ataque9.png',
        './webp/ataque10.png', './webp/ataque11.png', './webp/ataque12.png', './webp/ataque13.png', './webp/ataque14.png', './webp/ataque15.png', './webp/ataque16.png'
    ],
    boss_attack2: [
        './webp/ataque01.png', './webp/ataque02.png', './webp/ataque03.png', './webp/ataque04.png', './webp/ataque05.png',
        './webp/ataque06.png', './webp/ataque07.png', './webp/ataque08.png', './webp/ataque09.png'
    ],
    boss_death: ['./webp/morte.png'], 
    boss_falling_item: ['./webp/pedra_queda.png'],
    
    // Adicione os extras aqui para garantir que nada trave
    extras: [
        './webp/16.png', './webp/chao01.webp', './webp/chao02.webp',
        './webp/arvore.png', './webp/nature.png', './webp/nuvens.webp', 
        './webp/nuvenss.webp', './webp/heart.png', './webp/I.png',
        './webp/p1.png', './webp/p2.png', './webp/p3.png', './webp/p5.png', './webp/p6.png', './webp/p7.png', './webp/p9.png', './webp/p10.png', './webp/p11.png',
        './webp/P13.png', './webp/P14.png', './webp/P15.png', './webp/P17.png',
    ]
    };

    // ===================================================================
    // DEFINIÇÃO DAS ARMAS
    // ===================================================================
    const WEAPONS = {
        sword: {
            name: 'Espada',
            type: 'melee',
            damage: 2,
            cooldown: 150,
            animation: ASSETS.player_attack_sword,
            icon: ASSETS.icon_sword,
        },
        bow: {
            name: 'Arco',
            type: 'ranged',
            damage: 2,
            cooldown: 200,
            chargeAnimation: ASSETS.player_attack_bow_charge,
            maxChargeTime: 1500,
            icon: ASSETS.icon_bow,
            projectileType: 'arrow',
        },
        pistol: {
            name: 'Pistola',
            type: 'ranged',
            damage: 3,
            cooldown: 200,
            animation: ASSETS.player_attack_pistol,
            icon: ASSETS.icon_pistol,
            projectileType: 'bullet',
        }
    };

    // ===================================================================
    // DADOS DO NÍVEL
    // ===================================================================
    const LEVEL_DATA = {
        platforms: [
            { x: 200, y: 100, width: 100, height: 20 },
        ],
        items: [
            { type: 'bow', x: 1000, y: 0 }
        ]
    };

    // ===================================================================
    // FUNÇÕES E CLASSES UTILITÁRIAS
    // ===================================================================
    function checkCollision(r1, r2) {
        if (!r1 || !r2) return false;
        return r1.x < r2.x + r2.width &&
            r1.x + r1.width > r2.x &&
            r1.y < r2.y + r2.height &&
            r1.y + r1.height > r2.y;
    }

    class StateMachine {
        constructor() {
            this.states = {};
            this.currentState = null;
        }

        addState(name, config) {
            this.states[name] = config;
        }

        setState(name) {
            if (this.currentState?.name === name) return;
            this.currentState?.config.exit?.();
            const newState = this.states[name];
            if (!newState) return;
            this.currentState = { name: name, config: newState };
            newState.enter?.();
        }

        update(deltaTime, controls) {
            this.currentState?.config.update?.(deltaTime, controls);
        }
    }

    // ===================================================================
    // CLASSE PARA GERENCIAR A INTERFACE (UI)
    // ===================================================================
    class UI {
        constructor() {
            this.healthContainer = document.querySelector('.health-container');
            this.specialBar = document.querySelector('.special-bar');
            this.specialContainer = document.querySelector('.special-container');
            this.specialBtn = document.getElementById('btn-special');
            this.weaponSlotsContainer = document.getElementById('weapon-slots-container');
            this.hearts = [];
            this.specialSegments = [];

            for (let i = 0; i < CONFIG.PLAYER_HEALTH; i++) {
                const heart = document.createElement('div');
                heart.className = 'health-heart';
                this.healthContainer.appendChild(heart);
                this.hearts.push(heart);
            }

            for (let i = 0; i < CONFIG.SPECIAL_CHARGE_MAX; i++) {
                const segment = document.createElement('div');
                segment.className = 'special-segment';
                this.specialBar.appendChild(segment);
                this.specialSegments.push(segment);
            }
        }

        updateHealth(currentHealth) {
            this.hearts.forEach((heart, i) => {
                heart.classList.toggle('empty', i >= currentHealth);
            });
        }

        updateSpecial(currentCharge) {
            this.specialSegments.forEach((segment, i) => {
                segment.classList.toggle('charged', i < currentCharge);
            });

            const isReady = currentCharge >= CONFIG.SPECIAL_CHARGE_MAX;
            this.specialContainer.classList.toggle('ready', isReady);
            this.specialBtn.classList.toggle('ready', isReady);
        }

        updateWeapons(player) {
            this.weaponSlotsContainer.innerHTML = '';

            Object.keys(WEAPONS).forEach(weaponKey => {
                if (player.weapons.includes(weaponKey)) {
                    const weaponData = WEAPONS[weaponKey];
                    const slot = document.createElement('div');
                    slot.className = 'weapon-slot';
                    slot.style.backgroundImage = `url('${weaponData.icon}')`;
                    slot.dataset.weapon = weaponKey;

                    if (player.equippedWeapon === weaponKey) {
                        slot.classList.add('selected');
                    }

                    const handleEquip = (e) => {
                        e.stopPropagation();
                        player.equipWeapon(weaponKey);
                    };

                    slot.addEventListener('click', handleEquip);
                    slot.addEventListener('touchstart', handleEquip);
                    this.weaponSlotsContainer.appendChild(slot);
                }
            });
        }
    }

    // ===================================================================
    // CLASSE BASE PARA TODAS AS ENTIDADES DO JOGO
    // ===================================================================
    class Entity {
        constructor(x, y, width, height) {
            this.x = x;
            this.y = y;
            this.width = width;
            this.height = height;
            this.velocityX = 0;
            this.velocityY = 0;
            this.direction = 1;
            this.isGrounded = false;
            this.isMarkedForDeletion = false;
            this.isParalyzed = false;
            this.isBeingKnockedBack = false;

            this.element = document.createElement('div');
            this.element.style.width = `${width}px`;
            this.element.style.height = `${height}px`;

            this.stateMachine = new StateMachine();
            this.animations = {};
            this.currentAnimation = null;
            this.frame = 0;
            this.frameTimer = 0;
            this.frameDuration = 100;
        }

        updatePhysics(deltaTime, platforms) {
            if (!this.isBeingKnockedBack) {
                this.x += this.velocityX;
            }

            this.checkGrounded(platforms);

            if (!this.isGrounded) {
                this.velocityY -= CONFIG.GRAVITY;
            }

            this.y += this.velocityY;
            this.handlePlatformCollisions(platforms);
        }

        checkGrounded(platforms) {
            this.isGrounded = false;

            if (this.y <= 0 && this.velocityY <= 0) {
                this.y = 0;
                this.velocityY = 0;
                this.isGrounded = true;
                this.isBeingKnockedBack = false;
                return;
            }

            for (const platform of platforms) {
                const groundCheckHitbox = {
                    x: this.x + this.width * 0.2,
                    y: this.y - 10, // Check deeper (10px) to catch the platform
                    width: this.width * 0.6,
                    height: 10
                };

                // Verifica colisão com o hitbox do pé
                if (checkCollision(groundCheckHitbox, platform)) {
                    // Se estamos caindo ou parados, e estamos "acima" da plataforma (com tolerância)
                    const platformTop = platform.y + platform.height;

                    // Se os pés estão próximos do topo da plataforma (buffer de 15px)
                    if (this.velocityY <= 0 && Math.abs(this.y - platformTop) <= 15) {
                        this.y = platformTop;
                        this.velocityY = 0;
                        this.isGrounded = true;
                        this.isBeingKnockedBack = false;
                        return;
                    }
                }
            }
        }

        handlePlatformCollisions(platforms) {
            if (this.y < 0) {
                this.y = 0;
                this.velocityY = 0;
                this.isGrounded = true;
            }

            for (const platform of platforms) {
                if (this.velocityY <= 0 &&
                    this.x + this.width > platform.x &&
                    this.x < platform.x + platform.width &&
                    this.y < platform.y + platform.height &&
                    this.y + this.height > platform.y + platform.height) {

                    if ((this.y - this.velocityY * (1 / 60)) >= platform.y + platform.height) {
                        this.y = platform.y + platform.height;
                        this.velocityY = 0;
                        this.isGrounded = true;
                        return;
                    }
                }
            }
        }

        update(deltaTime, platforms) {
            if (this.isParalyzed) {
                this.stateMachine.update(deltaTime);
                return;
            }

            this.updatePhysics(deltaTime, platforms);

            this.frameTimer += deltaTime;
            if (this.frameTimer > this.frameDuration) {
                this.frameTimer = 0;
                const anim = this.currentAnimation;
                if (anim?.length > 1) {
                    this.frame = (this.frame + 1) % anim.length;
                    this.element.style.backgroundImage = `url('${anim[this.frame]}')`;
                }
            }
        }

        draw() {
            this.element.style.transform = `translateX(${Math.round(this.x)}px) translateY(${Math.round(-this.y)}px) scaleX(${this.direction})`;
            this.element.style.setProperty('--direction', this.direction);
            this.element.style.setProperty('--translateX', `${Math.round(this.x)}px`);
            this.element.style.setProperty('--translateY', `${Math.round(-this.y)}px`);
        }

        setAnimation(animationFrames, duration = 100) {
            if (this.currentAnimation === animationFrames) return;
            if (!animationFrames || animationFrames.length === 0) return;

            this.currentAnimation = animationFrames;
            this.frame = 0;
            this.frameDuration = duration;
            this.element.style.backgroundImage = `url('${animationFrames[0]}')`;
        }

        getHitbox() {
            const isCrouching = this.isCrouching || this.stateMachine.currentState?.name === 'crouching';

            // Valores base
            let targetWidth, targetHeight, targetY;

            if (isCrouching) {
                // Valores quando abaixado
                targetWidth = this.width * 0.1;
                targetHeight = this.height * 0.2;
                targetY = this.y + (this.height * 0.1);
            } else {
                // Valores quando em pé
                targetWidth = this.width * 0.1;
                targetHeight = this.height * 0.3;
                targetY = this.y + (this.height * 0.1);
            }

            // Interpolação suave (opcional)
            if (!this.lastHitbox) this.lastHitbox = { width: targetWidth, height: targetHeight, y: targetY };

            const lerp = (start, end, factor = 0.2) => start + (end - start) * factor;

            const currentWidth = lerp(this.lastHitbox.width, targetWidth, 0.3);
            const currentHeight = lerp(this.lastHitbox.height, targetHeight, 0.3);
            const currentY = lerp(this.lastHitbox.y, targetY, 0.3);

            this.lastHitbox = { width: currentWidth, height: currentHeight, y: currentY };

            const hitboxX = this.x + (this.width - currentWidth) / 2;

            return {
                x: hitboxX,
                y: currentY,
                width: currentWidth,
                height: currentHeight
            };
        }

        destroy(game) {
            if (game) game.addSpecialCharge(1);
            this.isMarkedForDeletion = true;
            if (this.element.parentElement) {
                this.element.remove();
            }
        }
    }

    // ===================================================================
    // CLASSE DO JOGADOR
    // ===================================================================
    class Player extends Entity {
        constructor(x, y, game) {
            super(x, y, 200, 180);
            this.game = game;
            this.element.className = 'character';
            this.health = CONFIG.PLAYER_HEALTH;
            this.isInvulnerable = false;
            this.isAttacking = false;
            this.enemiesHitInCurrentAttack = new Set();
            this.isBlocking = false;
            this.isMoving = false;
            this.trailTimeout = null;

            this.shieldMaxHealth = 100;
            this.shieldHealth = 100;
            this.isShieldBroken = false;
            this.shieldRegenRate = 0.5;
            this.shieldDrainRate = 0.5;

            this.weapons = ['pistol'];
            this.equippedWeapon = 'pistol';
            this.chargePower = 0;

            // Physics & Feel
            this.coyoteTimer = 0;
            this.jumpBufferTimer = 0;
            this.lastGroundedTime = 0;
            this.isJumping = false;

            this.animations = {
                idle: ASSETS.player_idle,
                walk: ASSETS.player_walk,
                jump: ASSETS.player_jump,
                crouch: ASSETS.player_crouch,
                block: ASSETS.player_block,
                special: ASSETS.player_special,
                attack_sword: ASSETS.player_attack_sword,
                attack_pistol: ASSETS.player_attack_pistol,
                bow_charge: ASSETS.player_attack_bow_charge,
            };

            this.initStates();
            this.stateMachine.setState('idle');
        }

        initStates() {
            this.stateMachine.addState('idle', {
                enter: () => this.setAnimation(this.animations.idle, 250),
                update: (dt, ctr) => {
                    if (!this.isGrounded) {
                        this.stateMachine.setState('jumping');
                    } else if (Math.abs(this.velocityX) > 0.1) {
                        this.stateMachine.setState('walking');
                    } else if (ctr.attackDown) {
                        this.stateMachine.setState('attacking');
                    } else if ((ctr.block || ctr.crouch) && !this.isShieldBroken) {
                        this.stateMachine.setState('blocking');
                    } else if (ctr.crouch || ctr.analogDown) {
                        this.stateMachine.setState('crouching');
                    }
                },
                exit: () => {
                    this.element.classList.remove('shield-active', 'shield-weak', 'shield-broken');
                    this.element.style.filter = '';
                    this.element.style.boxShadow = '';
                }
            });

            this.stateMachine.addState('crouching', {
                enter: () => {
                    this.isCrouching = true;
                    this.velocityX = 0;
                    this.setAnimation(this.animations.crouch, 200);
                    this.element.style.height = `${this.height * 0.7}px`;
                },
                update: (dt, ctr) => {
                    if (!ctr.crouch && !ctr.analogDown) {
                        this.stateMachine.setState('idle');
                    }
                    if (this.isBlocking && !this.isShieldBroken) {
                        this.shieldHealth -= this.shieldDrainRate;
                        if (this.shieldHealth <= 0) {
                            this.shieldHealth = 0;
                            this.isShieldBroken = true;
                            this.stateMachine.setState('idle');
                            setTimeout(() => { this.isShieldBroken = false; }, 3000);
                        }
                    } else {
                        if (this.shieldHealth < this.shieldMaxHealth) {
                            this.shieldHealth += this.shieldRegenRate;
                        }
                    }
                },
                exit: () => {
                    this.isCrouching = false;
                    this.element.style.height = `${this.height}px`;
                }
            });

            this.stateMachine.addState('walking', {
                enter: () => this.setAnimation(this.animations.walk, 100),
                update: (dt, ctr) => {
                    if (!this.isGrounded) {
                        this.stateMachine.setState('jumping');
                    } else if (Math.abs(this.velocityX) < 0.1) {
                        this.stateMachine.setState('idle');
                    } else if (ctr.attackDown) {
                        this.stateMachine.setState('attacking');
                    } else if ((ctr.block || ctr.crouch) && !this.isShieldBroken) {
                        this.stateMachine.setState('blocking');
                    } else if (ctr.crouch || ctr.analogDown) {
                        this.stateMachine.setState('crouching');
                    }
                },
                exit: () => {
                    this.element.classList.remove('shield-active', 'shield-weak', 'shield-broken');
                    this.element.style.filter = '';
                    this.element.style.boxShadow = '';
                }
            });

            this.stateMachine.addState('jumping', {
                enter: () => this.setAnimation(this.animations.jump, 150),
                update: (dt, ctr) => {
                    if (this.isGrounded) {
                        this.stateMachine.setState(Math.abs(this.velocityX) > 0.1 ? 'walking' : 'idle');
                    } else if (ctr.attackDown) {
                        this.stateMachine.setState('attacking');
                    }
                },
                exit: () => {
                    this.element.classList.remove('shield-active', 'shield-weak', 'shield-broken');
                    this.element.style.filter = '';
                    this.element.style.boxShadow = '';
                }
            });

this.stateMachine.addState('attacking', {
    enter: () => {
        const weapon = WEAPONS[this.equippedWeapon];
        this.enemiesHitInCurrentAttack.clear();
        
        if (weapon.chargeAnimation) {
            this.stateMachine.setState('bow_charge');
        } else {
            this.isAttacking = true;
            this.setAnimation(weapon.animation, weapon.cooldown / (weapon.animation.length || 1));
            
            // Dispara imediatamente (primeiro tiro)
            if (weapon.type === 'ranged') {
                this.game.spawnPlayerProjectile(1.0);
            }
            
            // Armazena o tempo do último tiro
            this.lastShotTime = performance.now();
        }
    },
    update: (deltaTime, controls) => {
    const weapon = WEAPONS[this.equippedWeapon];
    
    // Troca de animação dinâmica: se estiver andando, usa run_shoot, se parado, usa attack_pistol
    if (weapon.name === 'Pistola') {
        if (Math.abs(this.velocityX) > 0.5 && this.isGrounded) {
            this.setAnimation(ASSETS.player_run_shoot, 60); // Ajuste a velocidade (60ms) conforme necessário
        } else if (this.isGrounded) {
            this.setAnimation(weapon.animation, 100);
        }
    }

    if (!controls.attack) {
        this.isAttacking = false;
        if (this.isGrounded) {
            this.stateMachine.setState(Math.abs(this.velocityX) > 0.1 ? 'walking' : 'idle');
        } else {
            this.stateMachine.setState('jumping');
        }
        return;
    }
    
    if (weapon.type === 'ranged' && !weapon.chargeAnimation) {
        const currentTime = performance.now();
        if (currentTime - this.lastShotTime >= weapon.cooldown) {
            this.game.spawnPlayerProjectile(1.0);
            this.lastShotTime = currentTime;
            // Removi o reset de frame aqui para a animação de corrida não "engasgar"
        }
    }
},
    exit: () => {
        this.isAttacking = false;
        this.lastShotTime = 0;
    }
});

            this.stateMachine.addState('bow_charge', {
                enter: () => {
                    this.isAttacking = true;
                    this.velocityX *= 0.1;
                    this.chargeStartTime = performance.now();
                    this.setAnimation(this.animations.bow_charge, 1000);
                },
                update: (deltaTime, controls) => {
                    const chargeDuration = performance.now() - this.chargeStartTime;
                    this.chargePower = Math.min(chargeDuration / WEAPONS.bow.maxChargeTime, 1.0);

                    const chargeFrames = this.animations.bow_charge;
                    const frameIndex = Math.min(Math.floor(this.chargePower * chargeFrames.length), chargeFrames.length - 1);

                    if (this.frame !== frameIndex) {
                        this.frame = frameIndex;
                        this.element.style.backgroundImage = `url('${chargeFrames[this.frame]}')`;
                    }

                    if (controls.attackUp) {
                        this.game.spawnPlayerProjectile(this.chargePower);
                        this.isAttacking = false;
                        setTimeout(() => {
                            if (this.isGrounded) {
                                this.stateMachine.setState(Math.abs(this.velocityX) > 0.1 ? 'walking' : 'idle');
                            } else {
                                this.stateMachine.setState('jumping');
                            }
                        }, WEAPONS.bow.cooldown);
                    }
                },
                exit: () => {
                    this.isAttacking = false;
                    this.chargePower = 0;
                }
            });

            this.stateMachine.addState('blocking', {
                enter: () => {
                    this.isBlocking = true;
                    const shieldFrames = this.shieldHealth < (this.shieldMaxHealth * 0.3)
                        ? ASSETS.shield_crack
                        : ASSETS.shield_normal;
                    this.setAnimation(shieldFrames, 100);
                    this.element.classList.add('shield-active');
                },
                update: (dt, ctr) => {
                    if (!this.isShieldBroken) {
                        this.shieldHealth -= this.shieldDrainRate;

                        const shouldBeCracked = this.shieldHealth < (this.shieldMaxHealth * 0.3);
                        const isCurrentlyCracked = this.currentAnimation === ASSETS.shield_crack;

                        if (shouldBeCracked && !isCurrentlyCracked) {
                            this.setAnimation(ASSETS.shield_crack, 100);
                            this.element.classList.add('shield-weak');
                            this.element.classList.remove('shield-active');
                        } else if (!shouldBeCracked && isCurrentlyCracked && this.shieldHealth > 30) {
                            this.setAnimation(ASSETS.shield_normal, 100);
                            this.element.classList.remove('shield-weak');
                            this.element.classList.add('shield-active');
                        }

                        if (this.shieldHealth <= 0) {
                            this.shieldHealth = 0;
                            this.isShieldBroken = true;
                            this.element.classList.add('shield-broken');
                            this.element.classList.remove('shield-active', 'shield-weak');

                            setTimeout(() => {
                                if (this.stateMachine.currentState?.name === 'blocking') {
                                    this.stateMachine.setState('idle');
                                }
                            }, 500);

                            setTimeout(() => {
                                this.isShieldBroken = false;
                                this.shieldHealth = 20;
                            }, 3000);
                        }
                    }

                    const blockInput = (ctr.block || ctr.crouch) && !this.isShieldBroken;
                    if (!blockInput || !this.isGrounded) {
                        this.stateMachine.setState('idle');
                    }
                },
                exit: () => {
                    this.isBlocking = false;
                    this.element.classList.remove('shield-active', 'shield-weak', 'shield-broken');
                    this.element.style.filter = '';
                    this.element.style.boxShadow = '';
                    this.currentAnimation = null;
                }
            });

            this.stateMachine.addState('special', {
                enter: () => {
                    this.isAttacking = true;
                    this.velocityX = 0;
                    this.setAnimation(this.animations.special, 100);
                    this.element.classList.add('special-active');

                    setTimeout(() => {
                        this.isAttacking = false;
                        if (this.isGrounded) {
                            this.stateMachine.setState(Math.abs(this.velocityX) > 0.1 ? 'walking' : 'idle');
                        } else {
                            this.stateMachine.setState('jumping');
                        }
                        this.element.classList.remove('special-active');
                    }, 400);
                }
            });
        }

        update(deltaTime, controls, platforms) {
            if (this.isCrouching === undefined) {
                this.isCrouching = false;
            }

            if (!this.isBlocking && !this.isShieldBroken) {
                this.shieldHealth = Math.min(
                    this.shieldHealth + (this.shieldRegenRate * (deltaTime / 16)),
                    this.shieldMaxHealth
                );
            }

            if (this.stateMachine.currentState?.name === 'walking') {
                const speedFactor = Math.abs(this.velocityX) / CONFIG.PLAYER_SPEED;
                const baseDuration = 60;
                const adjustedDuration = baseDuration / Math.max(speedFactor, 0.5);

                if (Math.abs(this.frameDuration - adjustedDuration) > 10) {
                    this.frameDuration = adjustedDuration;
                }
            }

            const isRangedAttacking = this.stateMachine.currentState?.name === 'attacking' && WEAPONS[this.equippedWeapon].type === 'ranged';
const canControlMovement = (!this.isAttacking || isRangedAttacking) && !this.isBlocking && !this.isCrouching;

            if (canControlMovement) {
                // Aceleração
                if (controls.x !== 0) {
                    this.velocityX += controls.x * CONFIG.PLAYER_ACCELERATION;
                    this.direction = Math.sign(controls.x);
                } else {
                    // Atrito no chão
                    if (this.isGrounded) {
                        this.velocityX *= CONFIG.PLAYER_FRICTION;
                    } else {
                        this.velocityX *= CONFIG.PLAYER_AIR_RESISTANCE; // Menor atrito no ar
                    }
                }

                // Limite de velocidade
                this.velocityX = Math.max(Math.min(this.velocityX, CONFIG.PLAYER_SPEED), -CONFIG.PLAYER_SPEED);

                // Snap to 0 se estiver muito devagar
                if (Math.abs(this.velocityX) < 0.1) this.velocityX = 0;

            } else {
                if (!this.isBeingKnockedBack) {
                    if (this.isGrounded) {
                        this.velocityX *= CONFIG.PLAYER_FRICTION;
                    } else {
                        this.velocityX *= CONFIG.PLAYER_AIR_RESISTANCE;
                    }
                }
            }

            this.isMoving = Math.abs(this.velocityX) > 0.1;

            if (Math.abs(this.velocityX) > 5 && this.isGrounded && !this.isAttacking) {
                if (this.trailTimeout) clearTimeout(this.trailTimeout);
                this.trailTimeout = setTimeout(() => {
                }, 100);
            } else if (Math.abs(this.velocityX) <= 5) {
            }

            // Jump Buffering
            if (controls.jump) {
                this.jumpBufferTimer = CONFIG.JUMP_BUFFER;
            }
            if (this.jumpBufferTimer > 0) this.jumpBufferTimer -= deltaTime;

            // Coyote Time
            if (this.isGrounded) {
                this.coyoteTimer = CONFIG.COYOTE_TIME;
            } else {
                if (this.coyoteTimer > 0) this.coyoteTimer -= deltaTime;
            }

            // Pulo com Coyote Time e Buffer
            if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0 && canControlMovement && !this.isCrouching && !this.isAttacking) {
                this.jump();
                this.stateMachine.setState('jumping');
                this.jumpBufferTimer = 0; // Consome o pulo
                this.coyoteTimer = 0;     // Consome o coyote
            }

            // Pulo Variável (soltar botão corta pulo)
            if (!controls.jump && this.velocityY > 0 && this.isJumping) {
                this.velocityY *= CONFIG.PLAYER_JUMP_CUT;
                this.isJumping = false; // Impede cortar múltiplas vezes
            }

            if (controls.special && canControlMovement) {
                this.special();
            }

            if (this.isGrounded && (controls.crouch || controls.analogDown) && !this.isAttacking) {
                if (this.stateMachine.currentState?.name !== 'crouching') {
                    this.stateMachine.setState('crouching');
                }
            }

            super.update(deltaTime, platforms);
            this.stateMachine.update(deltaTime, controls);

            this.isAttacking = ['attacking', 'bow_charge', 'special'].includes(this.stateMachine.currentState?.name);
            this.isCrouching = this.stateMachine.currentState?.name === 'crouching';
            this.isBlocking = this.stateMachine.currentState?.name === 'blocking';
        }

        collectWeapon(weaponKey) {
            if (!this.weapons.includes(weaponKey)) {
                this.weapons.push(weaponKey);
                this.equipWeapon(weaponKey);
            }
        }

        equipWeapon(weaponKey) {
            if (this.weapons.includes(weaponKey)) {
                this.equippedWeapon = weaponKey;
                this.game.ui.updateWeapons(this);
            }
        }

        jump() {
            // O check de grounded não é mais necessário aqui pois quem chama gerencia isso (buffer/coyote)
            this.isGrounded = false;
            this.velocityY = CONFIG.PLAYER_JUMP_FORCE;
            this.isJumping = true;
        }

        special() {
            if (this.game.specialCharge >= CONFIG.SPECIAL_CHARGE_MAX) {
                this.game.activateSpecial();
                this.stateMachine.setState('special');
            }
        }

        takeDamage(amount) {
            if (this.isInvulnerable || this.isBlocking) return false;

            this.health -= amount;
            this.game.ui.updateHealth(this.health);
            this.isInvulnerable = true;
            this.element.classList.add('invulnerable');
            document.querySelector('.damage-effect').classList.add('active');

            setTimeout(() => {
                this.isInvulnerable = false;
                this.element.classList.remove('invulnerable');
            }, CONFIG.INVULNERABILITY_DURATION);

            setTimeout(() => {
                document.querySelector('.damage-effect').classList.remove('active');
            }, 100);

            if (this.health <= 0) {
                this.game.gameOver();
            }

            return true;
        }

        getAttackHitbox() {
            const weapon = WEAPONS[this.equippedWeapon];
            if (!this.isAttacking || weapon.type !== 'melee' || this.stateMachine.currentState.name === 'bow_charge') {
                return null;
            }

            const hitboxWidth = this.width * 0.4;
            const hitboxHeight = this.height * 0.1;
            let xOffset = this.direction === 1 ? this.width * 0.5 : -hitboxWidth + this.width * 0.5;
            const x = this.x + xOffset;
            const y = this.y + (this.height - hitboxHeight) / 4;

            return {
                x: x,
                y: y,
                width: hitboxWidth,
                height: hitboxHeight
            };
        }

        getDefenseHitbox() {
            if (!this.isBlocking) return null;

            const hitboxWidth = 30;
            const hitboxHeight = this.height * 1;
            const xOffset = this.direction === 1 ? this.width * 0.8 : this.width * 0.2 - hitboxWidth;
            const x = this.x + xOffset;
            const y = this.y + (this.height - hitboxHeight) / 2;

            return {
                x: x,
                y: y,
                width: hitboxWidth,
                height: hitboxHeight
            };
        }
    }


    // ===================================================================
    // CLASSE DOS PROJÉTEIS
    // ===================================================================
    class Projectile extends Entity {
        constructor(x, y, type, direction, chargePower = 1.0, damage = 1) {
            let asset, width, height, velX, velY, usesGravity;

            if (type === 'arrow') {
                asset = ASSETS.projectile_arrow;
                width = 35;
                height = 35;
                usesGravity = true;
                const minSpeed = 7;
                const maxSpeed = 22;
                const speed = minSpeed + (maxSpeed - minSpeed) * chargePower;
                const initialAngle = 4 - (3 * chargePower);
                velX = speed * direction;
                velY = initialAngle;
            } else {
                asset = ASSETS.projectile_bullet;
                width = 95;
                height = 95;
                usesGravity = false;
                velX = 12 * direction;
                velY = 0;
            }

            super(x, y, width, height);
            this.element.className = 'projectile';
            this.element.style.backgroundImage = `url('${asset}')`;
            this.direction = direction;
            this.velocityX = velX;
            this.velocityY = velY;
            this.usesGravity = usesGravity;
            this.damage = damage;
            this.chargePower = chargePower;

            if (type === 'arrow') {
                this.damage = Math.floor(damage * (0.5 + chargePower * 0.5));
                this.element.style.transformOrigin = 'center';
            }
        }

        update(deltaTime, platforms) {
            this.x += this.velocityX;

            if (this.usesGravity) {
                this.y += this.velocityY;
                this.velocityY -= CONFIG.GRAVITY * 0.8;

                if (this.y < 0) {
                    this.destroy();
                }

                const angle = Math.atan2(this.velocityY, this.velocityX * this.direction) * (180 / Math.PI);
                this.element.style.transform = `translateX(${this.x}px) translateY(${-this.y}px) scaleX(${this.direction}) rotate(${angle}deg)`;
            } else {
                this.y += this.velocityY;
                this.draw();
            }

            const cameraLeft = -(this.game?.worldX || 0);
            const cameraRight = cameraLeft + CONFIG.GAME_WIDTH;

            const buffer = 400;

            if (this.x < cameraLeft - buffer || this.x > cameraRight + buffer) {
                this.destroy();
            }
        }

        isVisible() {
            if (!this.game) return true;

            const cameraLeft = -(this.game.worldX || 0);
            const cameraRight = cameraLeft + CONFIG.GAME_WIDTH;
            const cameraTop = 0;
            const cameraBottom = CONFIG.GAME_HEIGHT;

            return this.x + this.width > cameraLeft - 100 &&
                this.x < cameraRight + 100 &&
                this.y + this.height > cameraTop &&
                this.y < cameraBottom;
        }

        draw() {
            if (this.usesGravity) {
                const angle = Math.atan2(this.velocityY, this.velocityX * this.direction) * (180 / Math.PI);
                this.element.style.transform = `translateX(${Math.round(this.x)}px) translateY(${Math.round(-this.y)}px) scaleX(${this.direction}) rotate(${angle}deg)`;
            } else {
                const worldOffset = this.game?.worldX || 0;
                this.element.style.transform = `translateX(${Math.round(this.x)}px) translateY(${Math.round(-this.y)}px) scaleX(${this.direction})`;
            }
        }

        getHitbox() {
            return {
                x: this.x,
                y: this.y,
                width: this.width,
                height: this.height
            };
        }
    }

    // ===================================================================
    // CLASSE DOS ITENS COLETÁVEIS
    // ===================================================================
    class PickupItem extends Entity {
        constructor(x, y, weaponKey) {
            super(x, y, 50, 50);
            this.element.className = 'pickup-item';
            this.weaponKey = weaponKey;

            let asset;
            if (weaponKey === 'bow') {
                asset = ASSETS.pickup_bow;
            } else if (weaponKey === 'pistol') {
                asset = ASSETS.pickup_pistol;
            }

            this.element.style.backgroundImage = `url('${asset}')`;
        }

        update() {
            // Itens não têm atualização física
        }
    }

    // ===================================================================
    // LÓGICA E TIPOS DE INIMIGOS
    // ===================================================================
    // ===================================================================
// LÓGICA E TIPOS DE INIMIGOS
// ===================================================================
const enemyTypes = {
    grounder: {
        width: 250,
        height: 250,
        health: 12,
        speed: 2.0,
        attackRange: 60,
        animations: {
            walk: ASSETS.enemy_walk,
            idle: [ASSETS.enemy_walk[0]]
        },
        init: function () {
            this.setAnimation(this.animations.walk, 200);
            this.stateMachine.addState('idle', {
                enter: () => {
                    this.velocityX = 0;
                }
            });
            this.stateMachine.addState('walking', {
                enter: () => {
                    this.setAnimation(this.animations.walk, 150);
                }
            });
            this.stateMachine.setState('walking');
        },
        brain: function () {
            if (this.isParalyzed || this.isBeingKnockedBack) {
                this.velocityX = 0;
                return;
            }

            const distX = this.player.x - this.x;
            const distY = Math.abs(this.player.y - this.y);

            if (Math.abs(distX) > 5) {
                this.direction = Math.sign(distX);
            }

            if (Math.abs(distX) > 400) {
                this.stateMachine.setState('walking');
                this.velocityX = this.direction * this.speed * 0.7;
                return;
            }

            this.stateMachine.setState('walking');

            if (Math.abs(distX) < 20) {
                this.velocityX = this.direction * (this.speed * 0.2);
            } else if (Math.abs(distX) < 60) {
                this.velocityX = this.direction * (this.speed * 0.6);
            } else {
                this.velocityX = this.direction * this.speed;
            }

            if (Math.abs(distX) < 40 && distY < 40 && Math.random() < 0.05) {
                if (checkCollision(this.getHitbox(), this.player.getHitbox())) {
                    this.player.takeDamage(1);
                }
            }

            if (this.isGrounded && this.player.y > this.y + 60 && Math.random() < 0.01) {
                this.velocityY = 12;
                this.isGrounded = false;
            }
        },
        update: function (deltaTime, platforms) {
            this.updatePhysics(deltaTime, platforms);
            this.brain();

            this.frameTimer += deltaTime;
            if (this.frameTimer > 150 && this.currentAnimation === this.animations.walk) {
                this.frameTimer = 0;
                this.frame = (this.frame + 1) % this.animations.walk.length;
                this.element.style.backgroundImage = `url('${this.animations.walk[this.frame]}')`;
            }
        }
    },
    flyer: {
        width: 80,
        height: 80,
        health: 8,
        speed: 1.8,
        verticalSpeed: 1,
        swoopSpeed: 4.5,
        projectileAttackCooldown: 3000,
        swoopAttackCooldown: 7000,
        animations: { fly: ASSETS.enemy_fly },
        init: function () {
            this.y = 200 + Math.random() * 100;
            this.targetY = this.y;
            this.projectileAttackTimer = Math.random() * this.projectileAttackCooldown;
            this.swoopAttackTimer = Math.random() * this.swoopAttackCooldown;
            this.bobbingTimer = 0;

            this.stateMachine.addState('flying', {
                enter: () => {
                    this.speed = 1.8;
                    this.targetY = 200 + Math.random() * 100;
                },
                update: (dT) => {
                    this.projectileAttackTimer += dT;
                    this.swoopAttackTimer += dT;
                    this.bobbingTimer += dT;

                    const distToPlayerX = Math.abs(this.player.x - this.x);

                    if (this.swoopAttackTimer > this.swoopAttackCooldown && distToPlayerX < 300) {
                        this.stateMachine.setState('swooping');
                        return;
                    }

                    if (this.projectileAttackTimer > this.projectileAttackCooldown && distToPlayerX < 200) {
                        this.game.spawnEnemyProjectile(this.x + (this.width / 2), this.y);
                        this.projectileAttackTimer = 0;
                    }

                    if (this.bobbingTimer > 4000) {
                        this.targetY = 180 + Math.random() * 120;
                        this.bobbingTimer = 0;
                    }

                    const dX = this.player.x - this.x;
                    if (Math.abs(dX) > 150) {
                        this.velocityX = Math.sign(dX) * this.speed;
                        this.direction = Math.sign(dX);
                    } else {
                        this.velocityX = 0;
                    }

                    if (Math.abs(this.y - this.targetY) > 2) {
                        this.velocityY = Math.sign(this.targetY - this.y) * this.verticalSpeed;
                    } else {
                        this.velocityY = 0;
                    }
                }
            });

            this.stateMachine.addState('swooping', {
                enter: () => {
                    this.swoopTargetX = this.player.x;
                    this.swoopTargetY = this.player.y + 20;
                    this.speed = this.swoopSpeed;
                    this.swoopAttackTimer = 0;
                },
                update: () => {
                    const dX = this.swoopTargetX - this.x;
                    const dY = this.swoopTargetY - this.y;
                    const distance = Math.sqrt(dX * dX + dY * dY);

                    if (distance < 30) {
                        this.stateMachine.setState('flying');
                        return;
                    }

                    this.velocityX = (dX / distance) * this.speed;
                    this.velocityY = (dY / distance) * this.speed;
                    this.direction = Math.sign(this.velocityX);
                },
                exit: () => {
                    this.speed = 1.8;
                    this.velocityY = 0;
                }
            });

            this.stateMachine.setState('flying');
        },
        update: function (dT, platforms) {
            if (this.isParalyzed) {
                this.velocityX = 0;
                this.velocityY = 0;
                return;
            }

            if (this.isBeingKnockedBack) {
                this.updatePhysics(dT, platforms);
            } else {
                this.x += this.velocityX;
                this.y += this.velocityY;
                if (this.y < 0) this.y = 0;
            }

            this.stateMachine.update(dT);
            this.setAnimation(this.animations.fly);
        }
    },
    // CORREÇÃO: sky_faller com coordenadas corrigidas
    sky_faller: {
        width: 120,
        height: 120,
        health: 8,
        speed: 2.0,
        animations: {
            fall: ASSETS.enemy_walk,
            walk: ASSETS.enemy_walk
        },
        init: function() {
            this.state = 'falling'; // Estados: falling, landing, walking
            this.fallSpeed = 10;
            this.landingTimer = 0;
            this.landingDuration = 300;
            this.setAnimation(this.animations.fall, 150);
        },
        update: function(deltaTime, platforms) {
            if (this.isParalyzed || this.isBeingKnockedBack) return;
            
            switch(this.state) {
                case 'falling':
                    // CORREÇÃO: Agora está correto - diminui Y até chegar a 0
                    this.y -= this.fallSpeed;
                    
                    // Verifica se chegou no chão (y <= 0)
                    if (this.y <= 0) {
                        this.y = 0;
                        this.isGrounded = true;
                        this.state = 'landing';
                        this.landingTimer = this.landingDuration;
                        // Pequeno efeito de impacto
                        this.element.classList.add('landing-impact');
                        setTimeout(() => {
                            this.element.classList.remove('landing-impact');
                        }, 300);
                    }
                    break;
                    
                case 'landing':
                    this.landingTimer -= deltaTime;
                    if (this.landingTimer <= 0) {
                        this.state = 'walking';
                        this.setAnimation(this.animations.walk, 150);
                    }
                    break;
                    
                case 'walking':
                    // Segue o jogador (agora usa this.player que foi passado na criação)
                    if (!this.player) return;
                    
                    const distX = this.player.x - this.x;
                    const distY = Math.abs(this.player.y - this.y);
                    
                    if (Math.abs(distX) > 5) {
                        this.direction = Math.sign(distX);
                    }
                    
                    // Movimento em direção ao jogador
                    this.velocityX = this.direction * this.speed;
                    
                    // Aplica física normal
                    this.updatePhysics(deltaTime, platforms);
                    
                    // Ataque se estiver perto
                    if (Math.abs(distX) < 40 && distY < 40 && Math.random() < 0.05) {
                        if (checkCollision(this.getHitbox(), this.player.getHitbox())) {
                            this.player.takeDamage(1);
                        }
                    }
                    break;
            }
            
            // Animações
            this.frameTimer += deltaTime;
            if (this.frameTimer > 150 && this.currentAnimation) {
                this.frameTimer = 0;
                this.frame = (this.frame + 1) % this.currentAnimation.length;
                this.element.style.backgroundImage = `url('${this.currentAnimation[this.frame]}')`;
            }
        }
    }
};

    // ===================================================================
    // CLASSE DOS INIMIGOS COM SISTEMA DE NÚMERO CRESCENTE
    // ===================================================================
    class Enemy extends Entity {
        constructor(x, y, typeName, player, game) {
            super(x, y, typeName.width, typeName.height);
            this.game = game;
            this.element.className = 'enemy';
            this.player = player;
            Object.assign(this, typeName);
            this.init();

            this.maxHealth = this.health || 12;
            this.currentHealth = this.maxHealth;

            this.totalDamageDisplay = 0;
            this.displayTimeout = null;
            this.displayDuration = 1500;
            this.damageElement = null;

            // this.createHealthBar();

            this.damageContainer = document.createElement('div');
            this.damageContainer.style.cssText = `
                position: absolute;
                top: 0;
                left: 50%;
                width: 0;
                height: 0;
                overflow: visible;
                pointer-events: none;
                z-index: 100;
            `;
            this.element.appendChild(this.damageContainer);

            const originalUpdate = this.update;
            this.update = (dt, platforms) => {
                if (originalUpdate) originalUpdate.call(this, dt, platforms);

                if (this.damageContainer) {
                    this.damageContainer.style.transform = `scaleX(${this.direction || 1})`;
                }
            };
        }

        createHealthBar() {
            const oldBar = this.element.querySelector('.enemy-health-bar-container');
            if (oldBar) oldBar.remove();

            this.healthBarContainer = document.createElement('div');
            this.healthBarContainer.className = 'enemy-health-bar-container';
            this.healthBarContainer.style.cssText = `
                position: absolute;
                top: -15px;
                left: 0;
                width: 100%;
                height: 6px;
                background: rgba(0,0,0,0.5);
                border-radius: 3px;
                overflow: hidden;
                z-index: 10;
            `;

            this.healthBar = document.createElement('div');
            this.healthBar.className = 'enemy-health-bar';
            this.healthBar.style.cssText = `
                width: 100%;
                height: 100%;
                background: linear-gradient(to right, #0f0, #ff0);
                transition: width 0.3s, background 0.3s;
            `;

            this.healthBarContainer.appendChild(this.healthBar);
            this.element.appendChild(this.healthBarContainer);

            this.updateHealthBar();
        }

        takeDamage(amount, source = null) {
            if (this.isParalyzed) {
                amount *= 1.5;
            }

            if (this.displayTimeout) {
                clearTimeout(this.displayTimeout);
            }

            this.totalDamageDisplay += amount;
            this.currentHealth -= amount;

            this.element.style.filter = 'brightness(1.5)';
            setTimeout(() => {
                this.element.style.filter = '';
            }, 100);

            this.showGrowingNumber();
            this.updateHealthBar();
            this.createDamageParticles();

            if (amount >= 2 && source) {
                const direction = source.x < this.x ? 1 : -1;
                this.applyKnockback(direction, 5);
            }

            this.displayTimeout = setTimeout(() => {
                this.resetDamageDisplay();
            }, this.displayDuration);

            if (this.currentHealth <= 0) {
                this.destroy(this.game);
                return true;
            }

            return false;
        }

        showGrowingNumber() {
            if (this.damageElement) {
                this.damageElement.remove();
            }

            this.damageElement = document.createElement('div');

            let color = '#ffffff';
            let strokeColor = '#000000';
            let fontSize = '36px';
            let shadowBlur = '0px';

            if (this.totalDamageDisplay >= 8) {
                color = '#FFD700';
                strokeColor = '#B8860B';
                fontSize = '52px';
                shadowBlur = '10px';
            } else if (this.totalDamageDisplay >= 5) {
                color = '#FF8C00';
                strokeColor = '#8B4500';
                fontSize = '44px';
            }

            this.damageElement.textContent = `-${this.totalDamageDisplay}`;

            this.damageElement.style.cssText = `
                position: absolute;
                left: 0;
                top: 20px;
                color: ${color};
                font-weight: normal;
                font-size: ${fontSize};
                font-family: 'Arial', sans-serif;
                animation: damagePulse 0.3s ease-out, damageFloat 1.2s ease-out forwards;
                pointer-events: none;
                z-index: 100;
                white-space: nowrap;
                display: flex;
                justify-content: center;
                align-items: center;
            `;

            this.damageContainer.appendChild(this.damageElement);

            this.damageElement.style.animation = 'none';
            void this.damageElement.offsetWidth;
            this.damageElement.style.animation = 'damagePulse 0.3s ease-out, damageFloat 1.2s ease-in forwards';
        }

        resetDamageDisplay() {
            if (this.damageElement && this.damageElement.parentElement) {
                this.damageElement.style.animation = 'damageFadeOut 0.8s ease-out forwards';
                setTimeout(() => {
                    if (this.damageElement && this.damageElement.parentElement) {
                        this.damageElement.remove();
                    }
                }, 800);
            }

            this.totalDamageDisplay = 0;
            this.displayTimeout = null;
        }

        updateHealthBar() {
            if (!this.healthBar) return;

            const percent = Math.max(0, (this.currentHealth / this.maxHealth) * 100);
            this.healthBar.style.width = `${percent}%`;

            if (percent > 60) {
                this.healthBar.style.background = 'linear-gradient(to right, #0f0, #ff0)';
            } else if (percent > 30) {
                this.healthBar.style.background = 'linear-gradient(to right, #ff0, #f80)';
            } else {
                this.healthBar.style.background = 'linear-gradient(to right, #f80, #f00)';
            }

            this.healthBarContainer.style.opacity = percent === 100 ? '0.5' : '1';
        }

        applyKnockback(direction, force = 25) { // Aumentei a força padrão para 12
            if (this.isBeingKnockedBack) return;

            this.isBeingKnockedBack = true;

            // Joga o inimigo na direção do ataque
            this.velocityX = direction * force;

            // Pequeno salto para dar efeito de impacto (opcional)
            if (this.isGrounded) {
                this.velocityY = 5;
                this.isGrounded = false;
            }

            // Piscar em branco/brilho para feedback visual
            this.element.style.filter = 'brightness(2) saturate(0)';

            setTimeout(() => {
                this.isBeingKnockedBack = false;
                this.element.style.filter = '';
                // Reduz a velocidade gradualmente após o impacto
                this.velocityX *= 0.5;
            }, 300); // Tempo que ele fica "voando" para trás
        }

        createDamageParticles() {
            for (let i = 0; i < 5; i++) {
                setTimeout(() => {
                    const particle = document.createElement('div');
                    particle.style.cssText = `
                        position: absolute;
                        width: 4px;
                        height: 4px;
                        background: #ff5555;
                        border-radius: 50%;
                        pointer-events: none;
                        z-index: 10;
                    `;

                    const offsetX = (Math.random() - 0.5) * this.width;
                    const offsetY = Math.random() * this.height * 0.5;

                    particle.style.left = `${this.width / 2 + offsetX}px`;
                    particle.style.bottom = `${offsetY}px`;

                    this.element.appendChild(particle);

                    particle.animate([
                        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
                        {
                            transform: `translate(${(Math.random() - 0.5) * 30}px, ${20 + Math.random() * 20}px) scale(0)`,
                            opacity: 0
                        }
                    ], {
                        duration: 600,
                        easing: 'ease-out'
                    }).onfinish = () => particle.remove();
                }, i * 50);
            }
        }

        destroy(game) {
            if (this.width === 250 && this.height === 250) {
                this.element.style.backgroundImage = `url('./webp/dinossauro_morto.webp')`;
                this.element.style.bottom = '-37px';

                this.velocityX = 0;
                this.velocityY = 0;
                this.y = 0;

                if (this.healthBarContainer) {
                    this.healthBarContainer.style.display = 'none';
                }
                if (this.damageContainer) {
                    this.damageContainer.style.display = 'none';
                }

                this.isDead = true;

                this.update = function (deltaTime, platforms) {
                    this.draw();
                };

                this.getHitbox = function () {
                    return null;
                };

                this.takeDamage = function () {
                    return false;
                };

                this.checkGrounded = function () {
                    this.isGrounded = true;
                };

                this.isMarkedForletion = false;

                setTimeout(() => {
                    this.element.style.transition = 'opacity 2s ease-in-out';
                    this.element.style.opacity = '0';

                    setTimeout(() => {
                        if (this.element.parentElement) {
                            this.element.remove();
                            this.isMarkedForDeletion = true;
                        }
                    }, 5000);
                }, 3000);

                if (game) game.addSpecialCharge(1);
                return;
            }

            super.destroy(game);
        }
    }

    // ===================================================================
    // CLASSE PARA GERENCIAR OS CONTROLES
    // ===================================================================
    class Controls {
        constructor() {
            this.x = 0;
            this.jump = false;
            this.block = false;
            this.special = false;
            this.crouch = false;
            this.analogDown = false;
            this.attack = false;
            this.attackDown = false;
            this.attackUp = false;
            
            

            this.keyMap = new Map();
            this.activeTouches = new Map();
            this.analogBase = document.querySelector('.analog-container');
            this.analogStick = document.querySelector('.analog-stick');
            this.crouchButtonActive = false;
            this.buttonControls = {
                'btn-jump': 'jump',
                'btn-attack': 'attack',
                'btn-block': 'block',
                'btn-special': 'special',
                'btn-crouch': 'crouchButton'
            };

            const gameContainer = document.getElementById('game-container');

            gameContainer.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
            gameContainer.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
            gameContainer.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
            gameContainer.addEventListener('touchcancel', this.handleTouchEnd.bind(this), { passive: false });

            document.addEventListener('keydown', this.handleKeyDown.bind(this));
            document.addEventListener('keyup', this.handleKeyUp.bind(this));

            this.setupButtonFeedback();
        }

        setupButtonFeedback() {
            Object.keys(this.buttonControls).forEach(id => {
                const btn = document.getElementById(id);
                if (btn) {
                    const keyBindings = {
                        'btn-jump': ['Space', 'ArrowUp', 'KeyW'],
                        'btn-attack': ['KeyX', 'KeyJ'],
                        'btn-block': ['KeyC', 'KeyK', 'ArrowDown', 'KeyS'],
                        'btn-special': ['KeyV', 'KeyL']
                    };

                    document.addEventListener('keydown', (e) => {
                        if (keyBindings[id]?.includes(e.code)) {
                            btn.classList.add('action-btn-active');
                        }
                    });

                    document.addEventListener('keyup', (e) => {
                        if (keyBindings[id]?.includes(e.code)) {
                            btn.classList.remove('action-btn-active');
                        }
                    });
                }
            });
        }

        handleKeyDown(e) {
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.preventDefault();
            }
            this.keyMap.set(e.code, true);
        }

        handleKeyUp(e) {
            this.keyMap.set(e.code, false);
        }

        handleTouchStart(e) {
            e.preventDefault();

            for (const touch of e.changedTouches) {
                const touchId = touch.identifier;
                let touchHandled = false;

                for (const btnId in this.buttonControls) {
                    const btn = document.getElementById(btnId);
                    if (btn && this.isTouchInside(touch, btn)) {
                        this.activeTouches.set(touchId, {
                            type: 'button',
                            buttonId: btnId
                        });
                        btn.classList.add('action-btn-active');

                        if (btnId === 'btn-crouch') {
                            this.crouchButtonActive = true;
                        }
                        touchHandled = true;
                        break;
                    }
                }

                if (!touchHandled && this.isTouchInside(touch, this.analogBase)) {
                    const rect = this.analogBase.getBoundingClientRect();
                    this.activeTouches.set(touchId, {
                        type: 'analog',
                        startX: touch.clientX,
                        currentX: touch.clientX,
                        baseRect: rect
                    });
                    this.analogStick.classList.add('dragging'); // Disable transition
                    touchHandled = true;
                }
            }
        }

        handleTouchMove(e) {
            e.preventDefault();

            for (const touch of e.changedTouches) {
                const touchId = touch.identifier;
                const touchData = this.activeTouches.get(touchId);

                if (touchData?.type === 'analog') {
                    const rect = touchData.baseRect;
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;
                    let deltaX = touch.clientX - centerX;
                    let deltaY = touch.clientY - centerY;
                    const maxDistance = rect.width / 2 - this.analogStick.offsetWidth / 2;
                    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

                    if (distance > maxDistance) {
                        const angle = Math.atan2(deltaY, deltaX);
                        deltaX = maxDistance * Math.cos(angle);
                        deltaY = maxDistance * Math.sin(angle);
                    }

                    this.analogStick.style.transform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px))`;
                    touchData.currentX = touch.clientX;
                    touchData.currentY = touch.clientY;
                }
            }
        }

        handleTouchEnd(e) {
            e.preventDefault();

            for (const touch of e.changedTouches) {
                const touchId = touch.identifier;
                const touchData = this.activeTouches.get(touchId);

                if (touchData) {
                    if (touchData.type === 'button') {
                        document.getElementById(touchData.buttonId)?.classList.remove('action-btn-active');
                        if (touchData.buttonId === 'btn-crouch') {
                            this.crouchButtonActive = false;
                        }
                    } else if (touchData.type === 'analog') {
                        this.analogStick.classList.remove('dragging'); // Re-enable transition for smooth return
                        this.analogStick.style.transform = 'translate(0px, 0px)'; // CSS centers it, we just reset offset
                    }
                }
                this.activeTouches.delete(touchId);
            }
        }


        isTouchInside(touch, element) {
            const rect = element.getBoundingClientRect();
            return touch.clientX >= rect.left &&
                touch.clientX <= rect.right &&
                touch.clientY >= rect.top &&
                touch.clientY <= rect.bottom;
        }

        update() {
            const prevAttackState = this.attack;

            let keyboardX = 0;
            if (this.keyMap.get('ArrowLeft') || this.keyMap.get('KeyA')) keyboardX = -1;
            if (this.keyMap.get('ArrowRight') || this.keyMap.get('KeyD')) keyboardX = 1;

            const keyboardAttackHeld = this.keyMap.get('KeyX') || this.keyMap.get('KeyJ');
            const keyboardBlock = this.keyMap.get('KeyC') || this.keyMap.get('KeyK');
            const keyboardCrouch = this.keyMap.get('ArrowDown') || this.keyMap.get('KeyS');
            const keyboardJump = this.keyMap.get('Space') || this.keyMap.get('ArrowUp') || this.keyMap.get('KeyW');
            const keyboardSpecial = this.keyMap.get('KeyV') || this.keyMap.get('KeyL');

            let touchAnalogX = 0;
            let touchAnalogY = 0;
            let touchAnalogActive = false;
            let touchJumpActive = false,
                touchBlockActive = false,
                touchSpecialActive = false,
                touchAttackHeld = false;

            for (const [_, touchData] of this.activeTouches) {
                if (touchData.type === 'analog') {
                    touchAnalogActive = true;
                    const rect = touchData.baseRect;
                    const centerX = rect.left + rect.width / 2;
                    const deltaX = touchData.currentX - centerX;

                    if (Math.abs(deltaX) > 10) {
                        touchAnalogX = Math.sign(deltaX);
                    }
                } else if (touchData.type === 'button') {
                    switch (touchData.buttonId) {
                        case 'btn-jump':
                            touchJumpActive = true;
                            break;
                        case 'btn-attack':
                            touchAttackHeld = true;
                            break;
                        case 'btn-block':
                            touchBlockActive = true;
                            break;
                        case 'btn-special':
                            touchSpecialActive = true;
                            break;
                    }
                }
            }

            for (const [_, touchData] of this.activeTouches) {
                if (touchData.type === 'analog') {
                    touchAnalogActive = true;
                    const rect = touchData.baseRect;
                    const centerY = rect.top + rect.height / 2;
                    const deltaY = touchData.currentY - centerY;

                    if (deltaY > 20) {
                        touchAnalogY = 1;
                    }
                }
            }

            this.analogDown = (touchAnalogY > 0) || keyboardCrouch;
            this.crouch = keyboardCrouch || this.crouchButtonActive || this.analogDown;

            this.x = touchAnalogActive ? touchAnalogX : keyboardX;
            this.attack = keyboardAttackHeld || touchAttackHeld;
            this.jump = keyboardJump || touchJumpActive;
            this.block = keyboardBlock || touchBlockActive;
            this.special = keyboardSpecial || touchSpecialActive;

            this.attackDown = this.attack && !prevAttackState;
            this.attackUp = !this.attack && prevAttackState;
        }
    }

    // Pré-carrega todas as imagens
    function preloadAssets() {
        const images = Object.values(ASSETS).flat().filter(url => url);
        images.forEach(url => {
            const img = new Image();
            img.src = url;
        });
    }

    window.addEventListener('load', preloadAssets);

 class Boss extends Entity {
    constructor(x, y, game) {
        super(x, y, 600, 700); // Boss Gigante
        this.game = game;
        this.element.className = 'boss-entity';
        this.health = 150; // Vida alta
        this.isDead = false;
        this.attackTimer = 0;
        this.attackInterval = 4000;
        this.hasSpawnedProjectiles = false; // Controle de spawn

        this.initStates();
        this.stateMachine.setState('activating');
    }

    initStates() {
        this.stateMachine.addState('activating', {
            enter: () => this.setAnimation(ASSETS.boss_activate, 200),
            update: () => {
                if (this.frame === ASSETS.boss_activate.length - 1) {
                    this.stateMachine.setState('idle');
                }
            }
        });

        this.stateMachine.addState('idle', {
            enter: () => this.setAnimation(ASSETS.boss_idle, 120),
            update: (dt) => {
                this.attackTimer += dt;
                if (this.attackTimer >= this.attackInterval) {
                    this.attackTimer = 0;
                    this.stateMachine.setState(Math.random() > 0.5 ? 'attack1' : 'attack2');
                }
            }
        });

        this.stateMachine.addState('attack1', {
            enter: () => {
                this.setAnimation(ASSETS.boss_attack1, 100);
                this.hasSpawnedProjectiles = false;
            },
            update: () => {
                if (this.frame === 8 && !this.hasSpawnedProjectiles) {
                    this.spawnFallingItems(12);
                    this.hasSpawnedProjectiles = true;
                }
                if (this.frame === ASSETS.boss_attack1.length - 1) this.stateMachine.setState('idle');
            }
        });

        this.stateMachine.addState('attack2', {
            enter: () => {
                this.setAnimation(ASSETS.boss_attack2, 100);
                this.hasSpawnedProjectiles = false;
            },
            update: () => {
                if (this.frame === 5 && !this.hasSpawnedProjectiles) {
                    this.spawnFallingItems(20);
                    this.hasSpawnedProjectiles = true;
                }
                if (this.frame === ASSETS.boss_attack2.length - 1) this.stateMachine.setState('idle');
            }
        });

        this.stateMachine.addState('death', {
            enter: () => {
                this.isDead = true;
                this.velocityX = 0;
                this.setAnimation(ASSETS.boss_death, 1000);
                this.element.style.filter = 'grayscale(1) brightness(0.5)';
            }
        });
    }

    spawnFallingItems(count) {
        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                const spawnX = this.game.player.x + (Math.random() * 1200 - 600);
                this.game.spawnEnemyAtPosition(spawnX, 800, 'sky_faller');
            }, i * 150);
        }
    }

   getHitbox() {
    if (this.isDead) return null;
    return {
        x: this.x + (this.width * 0.4), // Margem lateral de 10%
        y: this.y + (this.height * 0.15),
        width: this.width * 0.2,      // Ocupa 80% da largura visual
        height: this.height * 0.2     // Quase a altura toda
    };
}

    takeDamage(amount) {
        if (this.isDead) return;
        this.health -= amount;
        this.element.style.filter = 'brightness(2) sepia(1)';
        setTimeout(() => this.element.style.filter = '', 100);
        if (this.health <= 0) this.stateMachine.setState('death');
    }

    update(dt) {
        this.stateMachine.update(dt);
        this.frameTimer += dt;
        if (this.frameTimer > this.frameDuration) {
            this.frameTimer = 0;
            const anim = this.currentAnimation;
            if (anim?.length > 1) {
                this.frame = (this.frame + 1) % anim.length;
                this.element.style.backgroundImage = `url('${anim[this.frame]}')`;
            }
        }
    }
 draw() {
    // Adicione o scaleX para garantir que ele apareça (as vezes sem o scale ele fica invisível)
    // E arredonde os valores para evitar trepidação visual
    this.element.style.transform = `translateX(${Math.round(this.x)}px) translateY(${Math.round(-this.y)}px) scaleX(1)`;
}
}


    // ===================================================================
    // CLASSE PRINCIPAL DO JOGO
    // ===================================================================
    class Game {
        constructor() {
            this.gameWorld = document.getElementById('game-world');
            this.ui = new UI();
            this.player = new Player(0, 0, this);
            this.controls = new Controls();
            this.enemies = [];
            this.boss = null;
            this.spawnPoints = [];
            this.defineSpawnPoints();
            this.platforms = [];
            this.playerProjectiles = [];
            this.enemyProjectiles = [];
            this.pickupItems = [];
            this.lastTime = 0;
            this.worldX = 0;
            this.enemySpawnTimer = 0;
            this.enemySpawnInterval = 3000;
            this.specialCharge = 0;

            this.isGameOver = false;

            this.gameWorld.appendChild(this.player.element);
            this.createPlatforms();
            this.createPickupItems();
            this.loop = this.loop.bind(this);
        }

        
spawnBoss(x, y) {
    this.boss = new Boss(x, y, this);
    this.gameWorld.appendChild(this.boss.element);
}
        
        defineSpawnPoints() {
        // Define posições específicas onde os inimigos vão spawnar
        // Cada objeto tem: x, y (altura inicial), type, active (se deve spawnar)
        this.spawnPoints = [
            // Exemplo: spawn em x=1000, altura y=500, tipo sky_faller
            { x: 1000, y: 500, type: 'sky_faller', active: true },
            { x: 1500, y: 600, type: 'sky_faller', active: true },
            { x: 2000, y: 400, type: 'sky_faller', active: true },
            { x: 2500, y: 550, type: 'sky_faller', active: true },
            { x: 3000, y: 450, type: 'sky_faller', active: true },
            // Adicione quantos quiser
        ];
        
        // Você pode também definir grupos de spawn
        this.spawnGroups = [
            {
                name: 'primeira_onda',
                points: [
                    { x: 1200, y: 500, type: 'sky_faller' },
                    { x: 1400, y: 600, type: 'sky_faller' },
                    { x: 1600, y: 400, type: 'sky_faller' }
                ],
                activated: false
            },
            {
                name: 'segunda_onda',
                points: [
                    { x: 2200, y: 550, type: 'sky_faller' },
                    { x: 2400, y: 450, type: 'sky_faller' }
                ],
                activated: false
            }
        ];
    }
    
    spawnEnemyAtPoint(spawnPoint) {
        const enemyType = enemyTypes[spawnPoint.type];
        if (!enemyType) return;
        
        const enemy = new Enemy(
            spawnPoint.x, 
            spawnPoint.y, // Começa na altura especificada (acima do chão)
            enemyTypes[spawnPoint.type], 
            this.player, 
            this
        );
        
        this.enemies.push(enemy);
        this.gameWorld.appendChild(enemy.element);
        
        console.log(`Inimigo spawnado em (${spawnPoint.x}, ${spawnPoint.y})`);
        return enemy;
    }
    
    spawnEnemyGroup(groupName) {
        const group = this.spawnGroups.find(g => g.name === groupName);
        if (!group || group.activated) return;
        
        group.activated = true;
        group.points.forEach(point => {
            this.spawnEnemyAtPoint(point);
        });
        
        console.log(`Grupo ${groupName} ativado com ${group.points.length} inimigos`);
    }
    // ... código existente ...
    
    // Método para spawnar inimigo em posição específica
    spawnEnemyAtPosition(x, y, type = 'sky_faller') {
        const spawnPoint = { x, y, type, active: true };
        return this.spawnEnemyAtPoint(spawnPoint);
    }
    
    // Método para spawnar vários inimigos em linha
    spawnEnemiesInLine(startX, startY, count, spacing = 200, type = 'sky_faller') {
        const enemies = [];
        for (let i = 0; i < count; i++) {
            const x = startX + (i * spacing);
            const enemy = this.spawnEnemyAtPosition(x, startY, type);
            if (enemy) enemies.push(enemy);
        }
        return enemies;
    }
    
    // Método para spawnar em círculo/arco
    spawnEnemiesInArc(centerX, centerY, radius, count, type = 'sky_faller') {
        const enemies = [];
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            const enemy = this.spawnEnemyAtPosition(x, y, type);
            if (enemy) enemies.push(enemy);
        }
        return enemies;
    }


        createPlatforms() {
            LEVEL_DATA.platforms.forEach(d => {
                const e = document.createElement('div');
                e.className = 'platform';
                Object.assign(e.style, {
                    left: `${d.x}px`,
                    bottom: `${d.y}px`,
                    width: `${d.width}px`,
                    height: `${d.height}px`
                });
                this.gameWorld.appendChild(e);
                this.platforms.push(d);
            });
        }

        createPickupItems() {
            LEVEL_DATA.items.forEach(d => {
                const i = new PickupItem(d.x, d.y, d.type);
                this.pickupItems.push(i);
                this.gameWorld.appendChild(i.element);
            });
        }

        addSpecialCharge(amount) {
            if (this.specialCharge < CONFIG.SPECIAL_CHARGE_MAX) {
                this.specialCharge = Math.min(this.specialCharge + amount, CONFIG.SPECIAL_CHARGE_MAX);
                this.ui.updateSpecial(this.specialCharge);
            }
        }

        activateSpecial() {
            this.enemies.forEach(e => e.paralyze(CONFIG.SPECIAL_DURATION));
            this.specialCharge = 0;
            this.ui.updateSpecial(this.specialCharge);
        }

        spawnRandomEnemy() {
            const k = Object.keys(enemyTypes);
            const t = k[Math.floor(Math.random() * k.length)];
            const s = Math.random() < 0.5 ? 1 : -1;
            const x = this.player.x + (CONFIG.GAME_WIDTH * 0.7 * s) + (s * 200);
            const e = new Enemy(x, 0, enemyTypes[t], this.player, this);
            this.enemies.push(e);
            this.gameWorld.appendChild(e.element);
        }

       spawnPlayerProjectile(chargePower) {
    const weapon = WEAPONS[this.player.equippedWeapon];
    if (weapon.type !== 'ranged') return;

    let projX, projY;

    // AJUSTE ESPECÍFICO POR ARMA
    if (this.player.equippedWeapon === 'bow') {
        // Posição para a PEDRA
        projX = this.player.direction > 0 ? 
            this.player.x + this.player.width - 60 : // Ajuste o -80 (mais perto ou longe do corpo)
            this.player.x + 20;                      // Ajuste o +30 (mais perto ou longe do corpo)
        
        projY = this.player.y + this.player.height / 9.5; // Ajuste o divisor para subir/descer a pedra
    } else {
        // Posição padrão para a PISTOLA (seu código atual)
        projX = this.player.direction > 0 ?
            this.player.x + this.player.width - 150 :
            this.player.x + 100;
        
        projY = this.player.y + this.player.height / 15;
    }

    const projectile = new Projectile(projX, projY, weapon.projectileType,
        this.player.direction, chargePower, weapon.damage);
    
    projectile.game = this;
    this.playerProjectiles.push(projectile);
    this.gameWorld.appendChild(projectile.element);
}

        spawnEnemyProjectile(x, y) {
            const p = new Projectile(x, y, 'bullet', 0);
            p.usesGravity = true;
            p.velocityY = -2;
            p.game = this;
            p.width = 25;
            p.height = 25;
            this.enemyProjectiles.push(p);
            this.gameWorld.appendChild(p.element);
        }

        update(deltaTime) {
            if (this.isGameOver) return;

            this.controls.update();
            this.player.update(deltaTime, this.controls, this.platforms);

     // Dentro do update da classe Game, procure a parte do Boss:
if (this.boss) {
    this.boss.update(deltaTime);
    const bossHitbox = this.boss.getHitbox();

    // Projéteis do jogador
    this.playerProjectiles.forEach(p => {
        if (bossHitbox && checkCollision(p.getHitbox(), bossHitbox)) {
            console.log("Boss atingido! Vida restante:", this.boss.health); // Debug
            this.boss.takeDamage(p.damage);
            p.destroy();
        }
    });
}
            this.enemySpawnTimer += deltaTime;
            if (this.enemySpawnTimer > this.enemySpawnInterval && this.enemies.length < 5) {
                this.enemySpawnTimer = 0;
                this.spawnRandomEnemy();
            }

            this.enemies.forEach(e => {
                e.update(deltaTime, this.platforms);

                if (checkCollision(this.player.getHitbox(), e.getHitbox()) && !e.isBeingKnockedBack) {
                    this.player.takeDamage(1);
                }

                if (this.player.isBlocking && checkCollision(this.player.getDefenseHitbox(), e.getHitbox())) {
                    e.applyKnockback(this.player.direction);
                }
                
                this.spawnPoints.forEach((point, index) => {
            if (point.active) {
                // Verifica se o jogador está perto o suficiente
                const distanceToPlayer = Math.abs(this.player.x - point.x);
                
                // Spawn quando o jogador chega a 300 pixels do ponto
                if (distanceToPlayer < 300) {
                    this.spawnEnemyAtPoint(point);
                    point.active = false; // Não spawna de novo
                }
            }
        });
        
        // Sistema de spawn por grupos (ativados manualmente ou por trigger)
        // Exemplo: ativar grupos baseado na posição do jogador
        if (this.player.x > 1000 && !this.spawnGroups[0].activated) {
            this.spawnEnemyGroup('primeira_onda');
        }
        
        if (this.player.x > 2000 && !this.spawnGroups[1].activated) {
            this.spawnEnemyGroup('segunda_onda');
        }

                const playerAttackHitbox = this.player.getAttackHitbox();
                if (playerAttackHitbox) {
                    this.enemies.forEach(e => {
                        // Verifica se o inimigo já foi atingido NESTE ataque
                        if (!this.player.enemiesHitInCurrentAttack.has(e)) {
                            if (checkCollision(playerAttackHitbox, e.getHitbox())) {

                                const weapon = WEAPONS[this.player.equippedWeapon];
                                const damage = weapon.damage || 1;

                                // Aplica o dano
                                const enemyDied = e.takeDamage(damage, this.player);

                                // REPELIR: Aplica o knockback imediatamente
                                const knockbackDir = this.player.direction;
                                e.applyKnockback(knockbackDir, 10); // 10 é a força do repelimento

                                // Adiciona o inimigo ao Set para ele não tomar dano de novo até o próximo ataque
                                this.player.enemiesHitInCurrentAttack.add(e);

                                if (enemyDied) {
                                    this.addSpecialCharge(1);
                                }
                            }
                        }
                    });
                } else {
                    // Se o jogador não está atacando (hitbox nula), garante que o Set está limpo
                    this.player.enemiesHitInCurrentAttack.clear();
                }
            });

            this.playerProjectiles.forEach(p => {
                p.update(deltaTime, this.platforms);
                this.enemies.forEach(e => {
                    if (checkCollision(p.getHitbox(), e.getHitbox())) {
                        const damage = p.damage || 1;
                        const enemyDied = e.takeDamage(damage, p);
                        if (enemyDied) {
                            this.addSpecialCharge(1);
                        }
                        p.destroy();
                    }
                });
            });

            this.enemyProjectiles.forEach(p => {
                p.update(deltaTime, this.platforms);
                if (checkCollision(this.player.getHitbox(), p.getHitbox())) {
                    this.player.takeDamage(1);
                    p.destroy();
                }
            });

            this.pickupItems.forEach(i => {
                if (checkCollision(this.player.getHitbox(), i.getHitbox())) {
                    this.player.collectWeapon(i.weaponKey);
                    i.destroy();
                }
            });

            this.enemies = this.enemies.filter(e => !e.isMarkedForDeletion);
            this.playerProjectiles = this.playerProjectiles.filter(p => !p.isMarkedForDeletion);
            this.enemyProjectiles = this.enemyProjectiles.filter(p => !p.isMarkedForDeletion);
            this.pickupItems = this.pickupItems.filter(i => !i.isMarkedForDeletion);
        }

        draw() {
            if (this.isGameOver) return;

            const targetWorldX = -this.player.x + CONFIG.GAME_WIDTH / 4;

            // Camera Smoothing (Lerp)
            this.worldX += (targetWorldX - this.worldX) * CONFIG.CAMERA_SMOOTHING;

            const minX = -5800 + CONFIG.GAME_WIDTH;
            const maxX = 50;
            this.worldX = Math.max(minX, Math.min(maxX, this.worldX));

            this.gameWorld.style.transform = `translate3d(${this.worldX}px, 0, 0)`;

            requestAnimationFrame(() => {
                document.getElementById('ground').style.backgroundPositionX = `${this.worldX}px`;
                document.getElementById('foreground').style.backgroundPositionX = `${this.worldX * 1.2}px`;
                document.getElementById('sky-background').style.backgroundPositionX = `${this.worldX * 0.1}px`;
            });

            this.player.draw();
            if (this.boss) this.boss.draw();
            this.enemies.forEach(e => e.draw());
            this.playerProjectiles.forEach(p => p.draw());
            this.enemyProjectiles.forEach(p => p.draw());
            this.pickupItems.forEach(i => i.draw());
        }

        drawDebug() {
            if (!CONFIG.DEBUG_MODE) return;

           

            document.querySelectorAll('.debug-hitbox').forEach(el => el.remove());

            const drawBox = (hitbox, color, isFixed = false) => {
                
                if (!hitbox) return;

                const box = document.createElement('div');
                box.className = 'debug-hitbox';
                const container = isFixed ? document.getElementById('game-container') : this.gameWorld;

                Object.assign(box.style, {
                    position: 'absolute',
                    left: `${hitbox.x}px`,
                    bottom: `${hitbox.y}px`,
                    width: `${hitbox.width}px`,
                    height: `${hitbox.height}px`,
                    border: `2px solid ${color}`,
                    zIndex: '9999'
                });

                container.appendChild(box);
            };

            drawBox(this.player.getHitbox(), 'cyan');
            drawBox(this.player.getAttackHitbox(), 'red');
            drawBox(this.player.getDefenseHitbox(), 'yellow');
            drawBox(this.boss?.getHitbox(), 'purple');
            

            const groundCheckHitbox = {
                x: this.player.x + this.player.width * 0.4,
                y: this.player.y - 5,
                width: this.player.width * 0.2,
                height: 1
            };

            drawBox(groundCheckHitbox, this.player.isGrounded ? 'lime' : 'orange');
            this.enemies.forEach(e => drawBox(e.getHitbox(), 'magenta'));
            this.playerProjectiles.forEach(p => drawBox(p.getHitbox(), 'lime'));
            this.enemyProjectiles.forEach(p => drawBox(p.getHitbox(), 'yellow'));
            this.pickupItems.forEach(i => drawBox(i.getHitbox(), 'white'));

            const chao = this.platforms[0];
            if (chao) {
                const groundBox = document.createElement('div');
                groundBox.className = 'debug-hitbox';
                Object.assign(groundBox.style, {
                    position: 'absolute',
                    left: `${chao.x}px`,
                    bottom: `${chao.y}px`,
                    width: `${chao.width}px`,
                    height: `${chao.height + 5}px`,
                    border: '2px solid lime',
                    backgroundColor: 'rgba(0, 255, 0, 0.2)',
                    zIndex: '9998'
                });
                this.gameWorld.appendChild(groundBox);
            }
        }

        gameOver() {
            this.isGameOver = true;
            const el = document.createElement('div');
            el.textContent = 'FIM DE JOGO';

            Object.assign(el.style, {
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                color: 'white',
                fontSize: '48px',
                fontWeight: 'bold',
                textShadow: '2px 2px 4px black',
                zIndex: '10000'
            });

            document.getElementById('game-container').appendChild(el);
        }

        loop(currentTime) {
            requestAnimationFrame(this.loop);

            const deltaTime = currentTime - lastFrameTime;
            lastFrameTime = currentTime;

            const clampedDelta = Math.min(deltaTime, 100);
            accumulator += clampedDelta;

            while (accumulator >= frameInterval) {
                this.update(frameInterval);
                accumulator -= frameInterval;
            }

            this.draw();
            if (CONFIG.DEBUG_MODE) {
                this.drawDebug();
            }
        }

        start() {
            this.ui.updateHealth(this.player.health);
            this.ui.updateSpecial(this.specialCharge);
            this.ui.updateWeapons(this.player);
            this.spawnRandomEnemy();
            this.boss = new Boss(500, 0, this); // Posicionado no X = 5000
            this.gameWorld.appendChild(this.boss.element);
            this.loop(0);
        }
    }

    // Iniciar o jogo
    const game = new Game();
    game.start();
});
