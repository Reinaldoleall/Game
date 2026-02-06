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
        DEBUG_MODE: false,
        PLAYER_SPEED: 7, // Aumentado para compensar aceleração
        PLAYER_ACCELERATION: 1.5,
        PLAYER_FRICTION: 0.8,
        PLAYER_AIR_RESISTANCE: 0.95,
        PLAYER_HEALTH: 8,
        POINTS_PER_ENEMY: 2,
        POINTS_FOR_EXTRA_HEART: 1000,
        MAX_EXTRA_HEARTS: 20,
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
        GAME_HEIGHT: 600,
        PIT_DAMAGE: 1,
        PIT_DAMAGE_TO_ENEMIES: 2, // Dano que o buraco causa aos inimigos
        RESPAWN_DELAY: 10,
        RESPAWN_POSITION: { x: 100, y: 100 }
    };

    // ===================================================================
    // ASSETS DO JOGO
    // ===================================================================
    const ASSETS = {
        player_idle: ['./webp/I.webp', './webp/I1.webp', './webp/I2.webp', './webp/I3.webp', './webp/I4.webp', './webp/I5.webp', './webp/I6.webp'],
        player_walk: [
            './webp/1.webp', './webp/2.webp', './webp/3.webp', './webp/4.webp',
            './webp/5.webp', './webp/6.webp', './webp/7.webp', './webp/8.webp',
            './webp/9.webp', './webp/10.webp', './webp/11.webp', './webp/12.webp',
            './webp/13.webp', './webp/14.webp', './webp/15.webp'
        ],
        // Localize o objeto ASSETS e adicione esta linha:
        player_run_shoot: [
            './webp/1c.webp', './webp/2c.webp', './webp/3c.webp', './webp/4c.webp',
            './webp/5c.webp', './webp/6c.webp', './webp/7c.webp', './webp/8c.webp',
            './webp/9c.webp', './webp/10c.webp', './webp/11c.webp', './webp/12c.webp',
            './webp/13c.webp', './webp/14c.webp', './webp/15c.webp', './webp/16c.webp'
        ],
        player_jump: ['./webp/p.webp', './webp/p3.webp', './webp/p4.webp', './webp/p9.webp', './webp/p11.webp', './webp/p15.webp', './webp/p16.webp', './webp/p17.webp',],
        player_crouch: ['./webp/b1.webp', './webp/b2.webp', './webp/b3.webp', './webp/b4.webp', './webp/b5.webp', './webp/b6.webp', './webp/b7.webp', './webp/b8.webp', './webp/b9.webp', './webp/b10.webp'],
        shield_normal: [
            './webp/esc.webp', './webp/esc1.webp', './webp/esc2.webp',
            './webp/esc3.webp', './webp/esc4.webp', './webp/esc5.webp',
            './webp/esc6.webp', './webp/esc7.webp', './webp/esc8.webp', './webp/esc9.webp', './webp/esc10.webp', './webp/esc11.webp'
        ],
        shield_crack: ['./webp/esc12.webp', './webp/esc13.webp', './webp/esc14.webp', './webp/esc15.webp', './webp/esc16.webp',],
        enemy_dead: ['./webp/dinossauro_morto.webp'],
        player_attack_sword: [
            './webp/espada1.webp', './webp/espada2.webp', './webp/espada3.webp'
        ],
        player_attack_bow_charge: ['./webp/chute.webp'],
        player_attack_pistol: ['./webp/a1.webp', './webp/a2.webp', './webp/a3.webp', './webp/a4.webp', './webp/a5.webp', './webp/a6.webp', './webp/a7.webp', './webp/a8.webp', './webp/a9.webp', './webp/a10.webp', './webp/a11.webp', './webp/a12.webp'],
        player_block: ['./webp/defesa.webp'],
        player_special: ['https://i.imgur.com/L127z5k.gif'],
        enemy_walk: ['./webp/d.webp', './webp/d1.webp', './webp/d2.webp', './webp/d3.webp', './webp/d4.webp', './webp/d5.webp', './webp/d6.webp', './webp/d7.webp', './webp/d8.webp', './webp/d9.webp', './webp/d10.webp', './webp/d11.webp', './webp/d12.webp', './webp/d13.webp', './webp/d14.webp',],
        enemy_fly: ['./webp/nave.webp', './webp/nave1.webp', './webp/nave2.webp', './webp/nave3.webp', './webp/nave4.webp', './webp/nave5.webp', './webp/nave6.webp', './webp/nave7.webp', './webp/nave8.webp', './webp/nave9.webp',],
        pickup_bow: './webp/pedra.webp',
        pickup_pistol: './webp/tiro.webp',
        projectile_arrow: './webp/pedra.webp',
        projectile_bullet: './webp/tiro.webp',
        icon_sword: './webp/espada.webp',
        icon_bow: './webp/pedra.webp',
        icon_pistol: './webp/tiro.webp',
        boss_barrier: './webp/boss_barrier.webp',
        // Adicione ao seu objeto ASSETS
        // Boss Assets - Certifique-se que esses arquivos existem na pasta webp
        boss_activate: ['./webp/monstro_ativo.webp', './webp/monstro_ativo1.webp', './webp/monstro_ativo2.webp'],
        boss_idle: [
            './webp/mloop.webp', './webp/mloop2.webp', './webp/mloop3.webp', './webp/mloop4.webp',
            './webp/mloop5.webp', './webp/mloop6.webp', './webp/mloop7.webp', './webp/mloop8.webp'
        ],
        boss_attack1: [
            './webp/ataque.webp', './webp/ataque1.webp', './webp/ataque2.webp', './webp/ataque3.webp', './webp/ataque4.webp',
            './webp/ataque5.webp', './webp/ataque6.webp', './webp/ataque7.webp', './webp/ataque8.webp', './webp/ataque9.webp',
            './webp/ataque10.webp', './webp/ataque11.webp', './webp/ataque12.webp', './webp/ataque13.webp', './webp/ataque14.webp', './webp/ataque15.webp', './webp/ataque16.webp'
        ],
        boss_attack2: [
            './webp/ataque01.webp', './webp/ataque02.webp', './webp/ataque03.webp', './webp/ataque04.webp', './webp/ataque05.webp',
            './webp/ataque06.webp', './webp/ataque07.webp', './webp/ataque08.webp', './webp/ataque09.webp'
        ],
        boss_death: [
            './webp/bossdeath(1).webp', './webp/bossdeath(2).webp', './webp/bossdeath(3).webp', './webp/bossdeath(4).webp', './webp/bossdeath(5).webp',
            './webp/bossdeath(6).webp', './webp/bossdeath(7).webp', './webp/bossdeath(8).webp', './webp/bossdeath(9).webp', './webp/bossdeath(10).webp',
            './webp/bossdeath(11).webp', './webp/bossdeath(12).webp', './webp/bossdeath(13).webp', './webp/bossdeath(14).webp', './webp/bossdeath(15).webp',
            './webp/bossdeath(16).webp', './webp/bossdeath(17).webp', './webp/bossdeath(18).webp', './webp/bossdeath(19).webp', './webp/bossdeath(20).webp',
            './webp/bossdeath(21).webp', './webp/bossdeath (22).webp', './webp/bossdeath(23).webp', './webp/bossdeath(24).webp', './webp/bossdeath(25).webp',
            './webp/bossdeath(26).webp', './webp/bossdeath(27).webp', './webp/bossdeath(28).webp', './webp/bossdeath(29).webp', './webp/bossdeath(30).webp',
            './webp/bossdeath(31).webp', './webp/bossdeath(32).webp', './webp/bossdeath(33).webp'
        ],
        boss_falling_item: ['./webp/bebe6.webp'],
        novo_inimigo_vinda: ['./webp/bebe6.webp'], // Sprite dele caindo
        novo_inimigo_correndo: [
            './webp/bebe.webp',
            './webp/bebe1.webp',
            './webp/bebe2.webp',
            './webp/bebe3.webp',
            './webp/bebe4.webp',
            './webp/bebe5.webp',
        ], // Sprites dele correndo

        pickup_points: './webp/coin.webp',
        pit_image: './webp/espinhos.webp',

        // Adicione os extras aqui para garantir que nada trave
        extras: [
            './webp/16.webp', './webp/chao01.webp', './webp/chao02.webp',
            './webp/arvore.webp', './webp/nature.webp', './webp/nuvens.webp',
            './webp/nuvenss.webp', './webp/heart.webp', './webp/I.webp',
            './webp/p1.webp', './webp/p2.webp', './webp/p3.webp', './webp/p5.webp', './webp/p6.webp', './webp/p7.webp', './webp/p9.webp', './webp/p10.webp', './webp/p11.webp',
            './webp/P13.webp', './webp/P14.webp', './webp/P15.webp', './webp/P17.webp',
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
            { x: 1000, y: 120, width: 100, height: 20 },
        ],
        items: [
            { type: 'bow', x: 1000, y: 0 }
        ],
        pits: [
            // { x: posição X, y: posição Y, width: largura, height: altura }
            { x: 500, y: 0, width: 100, height: 100, image: './webp/espinhos.webp' },
            { x: 1200, y: 0, width: 100, height: 100, image: './webp/espinhos.webp' },
            { x: 1300, y: 0, width: 100, height: 100, image: './webp/espinhos.webp' },
            { x: 1400, y: 0, width: 100, height: 100, image: './webp/espinhos.webp' },
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

    function checkCollisionRect(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y;
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

            // Novos seletores para o HUD redesenhado
            this.pointsDisplay = document.querySelector('.points-display-compact');

            // Removemos referências ao container antigo se existirem
            const oldPointsContainer = document.getElementById('points-container');
            if (oldPointsContainer) oldPointsContainer.remove();

            this.currentPoints = 0;
            this.extraHeartsEarned = 0;
            this.pointsForNextHeart = CONFIG.POINTS_FOR_EXTRA_HEART;
            this.hearts = [];
            this.specialSegments = [];

            this.initHealthHearts();
            this.initSpecialSegments();
            // initPointsDisplay não é mais necessário criar elementos, apenas atualizar
            this.updatePointsDisplay();

            // Garantir que os corações sejam criados se não estiverem no HTML (fallback)
            if (this.healthContainer.children.length === 0) {
                for (let i = 0; i < CONFIG.PLAYER_HEALTH; i++) {
                    const heart = document.createElement('div');
                    heart.className = 'health-heart';
                    this.healthContainer.appendChild(heart);
                    this.hearts.push(heart);
                }
            } else {
                // Se já existirem (recarregamento), apenas pega a referência
                this.hearts = Array.from(this.healthContainer.children);
            }

            for (let i = 0; i < CONFIG.SPECIAL_CHARGE_MAX; i++) {
                const segment = document.createElement('div');
                segment.className = 'special-segment';
                this.specialBar.appendChild(segment);
                this.specialSegments.push(segment);
            }
        }

        initHealthHearts() {
            for (let i = 0; i < CONFIG.PLAYER_HEALTH; i++) {
                const heart = document.createElement('div');
                heart.className = 'health-heart';
                this.healthContainer.appendChild(heart);
                this.hearts.push(heart);
            }
        }

        initSpecialSegments() {
            for (let i = 0; i < CONFIG.SPECIAL_CHARGE_MAX; i++) {
                const segment = document.createElement('div');
                segment.className = 'special-segment';
                this.specialBar.appendChild(segment);
                this.specialSegments.push(segment);
            }
        }

        initPointsDisplay() {
            // Método mantido vazio para compatibilidade se for chamado em outro lugar
        }

        // Método para adicionar pontos
        addPoints(points) {
            this.currentPoints += points;

            // Verifica se ganhou coração extra
            while (this.currentPoints >= this.pointsForNextHeart &&
                this.extraHeartsEarned < CONFIG.MAX_EXTRA_HEARTS) {

                this.earnExtraHeart();
                this.pointsForNextHeart += CONFIG.POINTS_FOR_EXTRA_HEART;
            }

            this.updatePointsDisplay();
        }

        earnExtraHeart() {
            this.extraHeartsEarned++;

            // Adiciona um novo coração
            const heart = document.createElement('div');
            heart.className = 'health-heart extra-heart';
            heart.style.animation = 'heartGrow 0.5s ease-out';
            this.healthContainer.appendChild(heart);
            this.hearts.push(heart);

            // Aumenta a vida máxima do jogador
            this.game.player.maxHealth++;
            this.game.player.health++;

            // Feedback visual
            this.showHeartEarnedFeedback();
        }

        showHeartEarnedFeedback() {
            // Cria efeito visual
            const feedback = document.createElement('div');
            feedback.textContent = '♥ +1 Vida!';
            feedback.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 48px;
            color: #ff5555;
            font-weight: bold;
            text-shadow: 0 0 10px #ff0000;
            z-index: 1000;
            animation: heartPop 1s ease-out forwards;
            pointer-events: none;
        `;

            document.body.appendChild(feedback);

            setTimeout(() => {
                feedback.remove();
            }, 1000);
        }

        updatePointsDisplay() {
            if (this.pointsDisplay) {
                this.pointsDisplay.textContent = this.currentPoints;
            }
        }

        updateHealth(currentHealth) {
            this.hearts.forEach((heart, i) => {
                const isExtra = heart.classList.contains('extra-heart');
                const isEmpty = i >= currentHealth;

                heart.classList.toggle('empty', isEmpty);

                // Dá um destaque especial aos corações extras
                if (isExtra && !isEmpty) {
                    heart.style.boxShadow = '0 0 8px #ff5555';
                }
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

        setAnimation(animationFrames, duration = 100, loop = true) {
            if (this.currentAnimation === animationFrames) return;
            if (!animationFrames || animationFrames.length === 0) return;

            this.currentAnimation = animationFrames;
            this.frame = 0;
            this.frameDuration = duration;
            this.loopAnimation = loop;
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

            const buffer = 1000;

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
            // Reduzimos o hitbox para 30% do tamanho da imagem e centralizamos
            const paddingX = this.width * 0.35;
            const paddingY = this.height * 0.35;

            return {
                x: this.x + paddingX,
                y: this.y + paddingY,
                width: this.width * 0.3,  // Apenas 30% da largura original
                height: this.height * 0.3 // Apenas 30% da altura original
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

                // --- LOGICA DE ANIMAÇÃO ADICIONADA ---
                this.setAnimation(this.animations.fly, 100); // 100ms por frame

                this.frameTimer += dT;
                if (this.frameTimer > this.frameDuration) {
                    this.frameTimer = 0;
                    const anim = this.currentAnimation;
                    if (anim && anim.length > 0) {
                        this.frame = (this.frame + 1) % anim.length;
                        this.element.style.backgroundImage = `url('${anim[this.frame]}')`;
                    }
                }
            }
        },
        // CORREÇÃO: sky_faller com coordenadas corrigidas
        sky_faller: {
            width: 120,  // Ajuste o tamanho do novo sprite
            height: 120,
            health: 5,   // Vida dele
            speed: 3.5,  // Velocidade dele correndo (mais rápido que o dino comum)
            animations: {
                fall: ASSETS.novo_inimigo_vinda,    // Sprite de queda
                run: ASSETS.novo_inimigo_correndo  // Sprites de corrida
            },
            init: function () {
                this.state = 'falling';
                this.fallSpeed = 12;
                this.setAnimation(this.animations.fall, 100);
            },
            update: function (deltaTime, platforms) {
                if (this.isParalyzed || this.isBeingKnockedBack) return;

                switch (this.state) {
                    case 'falling':
                        this.y -= this.fallSpeed;
                        if (this.y <= 0) {
                            this.y = 0;
                            this.isGrounded = true;
                            this.state = 'walking';
                            this.setAnimation(this.animations.run, 100); // Muda para animação de correr
                        }
                        break;

                    case 'walking':
                        if (!this.player) return;

                        // 1. Perseguição focada no centro (para funcionar dos dois lados)
                        const playerCenter = this.player.x + (this.player.width / 2);
                        const enemyCenter = this.x + (this.width / 2);
                        const diffX = playerCenter - enemyCenter;
                        this.direction = diffX > 0 ? 1 : -1;

                        if (Math.abs(diffX) > 5) {
                            this.velocityX = this.direction * this.speed;
                        } else {
                            this.velocityX = 0;
                        }

                        this.updatePhysics(deltaTime, platforms);

                        // 2. LÓGICA FÍSICA (Empurrão constante ao encostar)
                        if (checkCollision(this.getHitbox(), this.player.getHitbox())) {

                            // SEMPRE empurra o jogador (atrasa o movimento)
                            // Se o jogador tenta passar, ele é jogado um pouco para trás
                            this.player.velocityX = this.direction * 12;

                            // SEMPRE empurra o inimigo para trás também (efeito de colisão de corpos)
                            this.applyKnockback(-this.direction, 8);

                            // 3. LÓGICA DE DANO (Só acontece se o jogador não estiver invulnerável)
                            // O takeDamage já tem o controle interno de tempo/invulnerabilidade
                            this.player.takeDamage(1);
                        }
                        break;
                }

                // Sistema de animação genérico
                this.frameTimer += deltaTime;
                if (this.frameTimer > this.frameDuration && this.currentAnimation) {
                    this.frameTimer = 0;
                    this.frame = (this.frame + 1) % this.currentAnimation.length;
                    this.element.style.backgroundImage = `url('${this.currentAnimation[this.frame]}')`;
                }
            }
        },
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

        // Na classe Enemy, modifique o método destroy:
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

                // SPAWN COINS QUANDO O INIMIGO MORRE
                this.spawnCoinsOnDeath(game);

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
                if (game) {
                    game.enemyDestroyed(this);
                    game.addSpecialCharge(1);
                }
                return;
            }

            // PARA OUTROS TIPOS DE INIMIGOS TAMBÉM
            if (game) {
                // Spawn coins antes de destruir
                this.spawnCoinsOnDeath(game);

                game.enemyDestroyed(this);
                game.addSpecialCharge(1);
            }

            super.destroy(game);
        }

        // Adicione este método à classe Enemy:
        spawnCoinsOnDeath(game) {
            if (!game) return;

            // Determina quantas coins spawnar baseado no tipo de inimigo
            let coinCount = 1;
            let coinValue = 10;

            if (this.width === 250) { // Inimigo grande
                coinCount = 3;
                coinValue = 15;
            } else if (this.typeName === 'flyer') {
                coinCount = 2;
                coinValue = 12;
            } else if (this.typeName === 'sky_faller') {
                coinCount = 1;
                coinValue = 10;
            }

            // Spawn das coins
            for (let i = 0; i < coinCount; i++) {
                setTimeout(() => {
                    // Posição aleatória ao redor do inimigo
                    const offsetX = (Math.random() - 0.5) * 100;
                    const offsetY = Math.random() * 50 + 20;

                    const coinX = this.x + this.width / 2 + offsetX;
                    const coinY = this.y + offsetY;

                    game.spawnPointsPickup(coinX, coinY, coinValue);
                }, i * 100); // Pequeno delay entre cada coin
            }
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
            super(x, y, 600, 700);
            this.game = game;
            this.element.className = 'boss-entity';
            this.health = 150;
            this.maxHealth = 150;
            this.isDead = false;
            this.attackTimer = 0;
            this.attackInterval = 4000;
            this.hasSpawnedProjectiles = false;
            this.activated = false;

            // Garante que a barra de vida seja criada
            this.createHealthBar();

            this.initStates();
            this.stateMachine.setState('waiting');
        }

        // Método para criar a barra de vida do boss
        createHealthBar() {
            // Remove barra antiga se existir
            const oldBar = this.element.querySelector('.boss-health-bar');
            if (oldBar) oldBar.remove();

            // Cria nova barra
            this.healthBarContainer = document.createElement('div');
            this.healthBarContainer.className = 'boss-health-bar';
            this.healthBarContainer.style.cssText = `
            position: absolute;
            top: -40px;
            left: 50%;
            transform: translateX(-50%);
            width: 80%;
            height: 15px;
            background: rgba(0,0,0,0.7);
            border: 2px solid #8B0000;
            border-radius: 7px;
            overflow: hidden;
            z-index: 10;
            opacity: 0;
            transition: opacity 0.5s;
        `;

            this.healthBarFill = document.createElement('div');
            this.healthBarFill.className = 'boss-health-fill';
            this.healthBarFill.style.cssText = `
            width: 100%;
            height: 100%;
            background: linear-gradient(to right, #FF0000, #FF4500, #FFA500);
            transition: width 0.3s ease;
        `;

            this.healthBarContainer.appendChild(this.healthBarFill);
            this.element.appendChild(this.healthBarContainer);

            // Atualiza a barra inicialmente
            this.updateHealthBar();
        }

        // Método para atualizar a barra de vida
        updateHealthBar() {
            if (!this.healthBarFill) return;

            const percent = Math.max(0, (this.health / this.maxHealth) * 100);
            this.healthBarFill.style.width = `${percent}%`;

            // Muda a cor baseado na vida
            if (percent > 60) {
                this.healthBarFill.style.background = 'linear-gradient(to right, #FF0000, #FF4500, #FFA500)';
            } else if (percent > 30) {
                this.healthBarFill.style.background = 'linear-gradient(to right, #FF4500, #FFA500, #FFD700)';
            } else {
                this.healthBarFill.style.background = 'linear-gradient(to right, #FFA500, #FFD700, #FFFF00)';
            }
        }

        // Método para mostrar a barra
        showHealthBar() {
            if (this.healthBarContainer) {
                this.healthBarContainer.style.opacity = '1';
            }
        }

        // Método para esconder a barra
        hideHealthBar() {
            if (this.healthBarContainer) {
                this.healthBarContainer.style.opacity = '0';
            }
        }

        initStates() {
            this.stateMachine.addState('waiting', {
                enter: () => {
                    this.activated = false;
                    this.element.style.backgroundImage = `url('${ASSETS.boss_activate[0]}')`;
                    this.frame = 0;
                    this.hideHealthBar(); // Esconde a barra enquanto espera
                },
                update: () => {
                    // Não faz nada, fica apenas parado como um "objeto" do cenário
                }
            });

            this.stateMachine.addState('activating', {
                enter: () => {
                    this.activated = true;
                    this.setAnimation(ASSETS.boss_activate, 200);
                    // Mostra a barra de vida
                    this.showHealthBar();
                    // Atualiza a barra da UI
                    this.updateUIHealthBar();
                },
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
                        this.spawnFallingItems(4);
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
                        this.spawnFallingItems(5);
                        this.hasSpawnedProjectiles = true;
                    }
                    if (this.frame === ASSETS.boss_attack2.length - 1) this.stateMachine.setState('idle');
                }
            });

            // Estado 'death'
            this.stateMachine.addState('death', {
                enter: () => {
                    this.isDead = true;
                    // Animation frames, duration 100ms, loop = false
                    this.setAnimation(ASSETS.boss_death, 100, false);
                    this.hideHealthBar();

                    this.updateUIHealthBar();

                    if (this.game) {
                        this.game.addPoints(100, 'boss');
                    }
                },
                update: () => {
                    // Ao terminar a animação, remove o boss do DOM (opcional) ou deixa o corpo lá
                    if (this.frame === ASSETS.boss_death.length - 1) {
                        // Pode adicionar lógica extra aqui se quiser que ele suma depois
                    }
                }
            });
        }

        // Método para atualizar a barra na UI superior
        updateUIHealthBar() {
            const bossUI = document.getElementById('boss-ui');
            const healthBar = document.getElementById('boss-health-bar');

            if (bossUI && healthBar) {
                const percent = Math.max(0, (this.health / this.maxHealth) * 100);
                healthBar.style.width = `${percent}%`;

                // Muda a cor baseado na vida
                if (percent > 60) {
                    healthBar.style.background = 'linear-gradient(to right, #FF0000, #FF4500, #FFA500)';
                } else if (percent > 30) {
                    healthBar.style.background = 'linear-gradient(to right, #FF4500, #FFA500, #FFD700)';
                } else {
                    healthBar.style.background = 'linear-gradient(to right, #FFA500, #FFD700, #FFFF00)';
                }

                // Se a vida chegou a 0, esconde a UI após um tempo
                if (this.health <= 0) {
                    setTimeout(() => {
                        bossUI.style.display = 'none';
                    }, 2000);
                }
            }
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
            if (this.isDead || !this.activated) return null;
            return {
                x: this.x + (this.width * 0.4),
                y: this.y + (this.height * 0.2),
                width: this.width * 0.2,
                height: this.height * 0.1
            };
        }

        takeDamage(amount) {
            if (this.isDead || !this.activated) return false;

            this.health -= amount;

            // Atualiza ambas as barras de vida
            this.updateHealthBar();
            this.updateUIHealthBar();

            // Feedback visual
            this.element.style.filter = 'brightness(2) sepia(1)';
            setTimeout(() => {
                if (!this.isDead) this.element.style.filter = '';
            }, 100);

            // Verifica se morreu
            if (this.health <= 0) {
                this.health = 0;
                this.stateMachine.setState('death');
                return true;
            }

            // Adiciona pontos
            if (this.game && amount > 0) {
                this.game.addPoints(Math.floor(amount * 2), 'boss');
            }

            return true;
        }

        update(dt) {
            this.stateMachine.update(dt);
            if (this.stateMachine.currentState.name !== 'waiting') {
                this.frameTimer += dt;
                if (this.frameTimer > this.frameDuration) {
                    this.frameTimer = 0;
                    const anim = this.currentAnimation;
                    if (anim?.length > 1) {
                        // Lógica de loop vs one-shot
                        if (this.loopAnimation) {
                            this.frame = (this.frame + 1) % anim.length;
                        } else {
                            this.frame = Math.min(this.frame + 1, anim.length - 1);
                        }
                        this.element.style.backgroundImage = `url('${anim[this.frame]}')`;
                    }
                }
            }
        }

        draw() {
            this.element.style.transform = `translateX(${Math.round(this.x)}px) translateY(${Math.round(-this.y)}px) scaleX(1)`;
        }
    }

    class PointsPickup extends Entity {
        constructor(x, y, pointsValue = 10) {
            super(x, y, 30, 30);
            this.element.className = 'points-pickup';
            this.pointsValue = pointsValue;
            this.element.style.backgroundImage = `url('${ASSETS.pickup_points}')`;


            // REMOVIDO: this.element.style.animation = 'float 2s ease-in-out infinite';
            // A animação agora é feita via JS para sincronizar com o hitbox

            this.element.style.backgroundSize = 'contain';
            this.element.style.backgroundRepeat = 'no-repeat';
            this.element.style.backgroundPosition = 'center';

            this.velocityY = -5;
            this.isGrounded = false;
            this.rotation = 0;

            // Controle de flutuação via JS
            this.floatTimer = Math.random() * Math.PI * 2; // Começa em fase aleatória
            this.floatOffset = 0;

            // Posição inicial
            // CORREÇÃO: Garante que o elemento seja absoluto para posicionamento correto
            this.element.style.position = 'absolute';
            this.element.style.left = '0px';
            this.element.style.bottom = '0px'; // IMPORTANTE: Referência no chão para o translateY funcionar

            this.draw();
        }

        update(deltaTime) {
            // Safeguard para deltaTime
            const dt = deltaTime || 16;

            // Física
            if (!this.isGrounded) {
                this.velocityY -= CONFIG.GRAVITY * 0.3;
                this.y += this.velocityY;

                if (this.y <= 0) {
                    this.y = 0;
                    this.velocityY = 0;
                    this.isGrounded = true;
                }
            }

            // Atualizar rotação
            this.rotation += 2 * (dt / 16); // 2 graus por frame a 60fps

            // Atualizar flutuação (Senoide)
            this.floatTimer += dt / 1000 * 3; // Velocidade 3
            this.floatOffset = Math.sin(this.floatTimer) * 10; // Amplitude 10px

            this.draw();
        }

        draw() {
            // Aplicamos o floatOffset na posição Y visual
            const visualY = this.y + this.floatOffset;

            this.element.style.transform = `translateX(${Math.round(this.x)}px) translateY(${Math.round(-visualY)}px) scaleX(1)`;

            // Rotação separada para não interferir
            this.element.style.transform += ` rotate(${this.rotation}deg)`;
        }

        getHitbox() {
            // CORREÇÃO CRÍTICA: O hitbox deve usar as MESMAS coordenadas que o visual
            // Agora consideramos o floatOffset também para o hitbox

            return {
                x: this.x,
                y: this.y + this.floatOffset, // Adiciona o offset da flutuação
                width: this.width,
                height: this.height
            };
        }
    }

    // ===================================================================
    // CLASSE PRINCIPAL DO JOGO
    // ===================================================================
    class ParallaxSystem {
    constructor() {
        this.background = null;
        this.parallaxFactor = 0.1; // % da velocidade da câmera (MAIS LENTO)
        this.currentOffset = 0;
        this.targetOffset = 0;
        this.smoothing = 0.1; // Suavização
        this.isMoving = false;
        this.lastCameraX = 0;
        
        this.init();
    }

    init() {
        // Cria o elemento de parallax
        this.background = document.createElement('div');
        this.background.id = 'parallax-nature-bg';
        document.body.insertBefore(this.background, document.body.firstChild);
        
        // Pré-carrega a imagem
        this.preloadImage();
        
        console.log('✅ Sistema de parallax inicializado');
    }

    preloadImage() {
        const img = new Image();
        img.src = './webp/nature.webp';
        img.onload = () => {
            console.log('🌄 Background de parallax carregado');
            this.background.style.opacity = '1';
        };
    }

    // ATUALIZAÇÃO CORRIGIDA: Move na DIREÇÃO CONTRÁRIA ao jogador
    update(cameraX) {
        if (!this.background) return;
        
        // Calcula o movimento da câmera
        const cameraDelta = cameraX - this.lastCameraX;
        this.lastCameraX = cameraX;
        
        // Se a câmera não está se movendo, não atualiza
        if (Math.abs(cameraDelta) < 0.1) {
            this.isMoving = false;
            return;
        }
        
        this.isMoving = true;
        
        this.targetOffset = cameraX * this.parallaxFactor * -1;
        
        // Suavização
        this.currentOffset += (this.targetOffset - this.currentOffset) * this.smoothing;
        
        // Aplica a transformação
        this.background.style.transform = `translate3d(${this.currentOffset}px, 0, 0)`;
    }

    // Alternativa: controle direto baseado na direção do jogador
    updateWithPlayer(playerX, playerDirection, cameraX) {
        if (!this.background) return;
        
        // Se o jogador não está se movendo, não atualiza
        if (Math.abs(playerDirection) < 0.1) {
            this.isMoving = false;
            return;
        }
        
        this.isMoving = true;
        
        // *** LÓGICA DE PARALLAX CORRETA ***
        // playerDirection > 0 = jogador indo para DIREITA
        // playerDirection < 0 = jogador indo para ESQUERDA
        
        if (playerDirection > 0) {
            // Jogador indo para DIREITA → Background deve ir para ESQUERDA (-)
            this.targetOffset -= this.parallaxFactor * Math.abs(playerDirection);
        } else {
            // Jogador indo para ESQUERDA → Background deve ir para DIREITA (+)
            this.targetOffset += this.parallaxFactor * Math.abs(playerDirection);
        }
        
        // Limita o offset para não sair muito
        this.targetOffset = Math.max(-1000, Math.min(1000, this.targetOffset));
        
        // Suavização
        this.currentOffset += (this.targetOffset - this.currentOffset) * 0.08;
        
        // Aplica
        this.background.style.transform = `translate3d(${this.currentOffset}px, 0, 0)`;
    }

    reset() {
        this.currentOffset = 0;
        this.targetOffset = 0;
        this.lastCameraX = 0;
        
        if (this.background) {
            this.background.style.transform = 'translate3d(0, 0, 0)';
        }
    }
}
    class Game {
        constructor() {
            this.gameWorld = document.getElementById('game-world');
            this.parallaxSystem = new ParallaxSystem();
            this.ui = new UI();
            this.ui.game = this;
            this.player = new Player(0, 0, this);
            this.controls = new Controls();
            this.enemies = [];
            this.boss = null;
            this.pits = [];
            this.isRespawning = false;
            this.respawnTimer = 0;
            this.createPits();
            this.spawnPoints = [];
            this.defineSpawnPoints();
            this.platforms = [];
            this.playerProjectiles = [];
            this.enemyProjectiles = [];
            this.pickupItems = [];
            this.bossBarriers = [];
            this.lastTime = 0;
            this.worldX = 0;
            this.enemySpawnTimer = 0;
            this.enemySpawnInterval = 3000;
            this.specialCharge = 0;

            this.isGameOver = false;

            this.totalPoints = 0;

            this.gameWorld.appendChild(this.player.element);
            this.createPlatforms();
            this.createPickupItems();
            this.loop = this.loop.bind(this);

            // Dentro do constructor da Game
            this.bossArena = {
                active: false,
                xTrigger: 5900,      // Posição onde a luta começa
                leftBoundary: 5000,  // Onde o player fica preso (atrás)
                rightBoundary: 6000, // Onde o player fica preso (frente)
                isResolved: false    // Se o boss já morreu
            };
        }

        checkProjectilesInPits(pit) {
            // Verifica projéteis do jogador
            this.playerProjectiles.forEach(projectile => {
                if (!projectile.isMarkedForDeletion) {
                    const projectileHitbox = projectile.getHitbox();

                    if (projectileHitbox && checkCollision(projectileHitbox, pit)) {
                        console.log(`🎯 Projétil caiu no buraco!`);
                        projectile.destroy();

                        // Efeito visual
                        this.createPitEffect(projectile.x, projectile.y, 'projectile');
                    }
                }
            });

            // Verifica projéteis dos inimigos
            this.enemyProjectiles.forEach(projectile => {
                if (!projectile.isMarkedForDeletion) {
                    const projectileHitbox = projectile.getHitbox();

                    if (projectileHitbox && checkCollision(projectileHitbox, pit)) {
                        console.log(`🎯 Projétil inimigo caiu no buraco!`);
                        projectile.destroy();

                        // Efeito visual
                        this.createPitEffect(projectile.x, projectile.y, 'projectile');
                    }
                }
            });
        }

        addPoints(points, source = null) {
            const bonusMultiplier = this.getPointsMultiplier(source);
            const totalPoints = points * bonusMultiplier;

            this.totalPoints += totalPoints;
            this.ui.addPoints(totalPoints);

            // Feedback visual de pontos
            this.showPointsGained(points, source);

            console.log(`+${totalPoints} pontos! (Total: ${this.totalPoints})`);

        }


        spawnPointsPickup(x, y, value = 10) {
            const pickup = new PointsPickup(x, y, value);
            this.pickupItems.push(pickup);
            this.gameWorld.appendChild(pickup.element);
        }

        getPointsMultiplier(source) {
            let multiplier = 1;

            // Multiplicadores baseados na situação
            if (source === 'boss') {
                multiplier = 5; // 5x pontos do boss
            } else if (source === 'combo') {
                multiplier = 1.5; // 1.5x por combo
            } else if (this.player.health <= 3) {
                multiplier = 2; // 2x quando está com pouca vida
            }

            return multiplier;
        }

        showPointsGained(points, source) {
            // Cria popup de pontos
            const pointsPopup = document.createElement('div');
            pointsPopup.textContent = `+${points}`;

            // Estilo baseado na fonte
            let color = '#ffffff';
            let fontSize = '24px';

            if (source === 'boss') {
                color = '#FFD700';
                fontSize = '32px';
            } else if (points >= 20) {
                color = '#FF8C00';
                fontSize = '28px';
            }

            pointsPopup.style.cssText = `
            position: absolute;
            left: ${this.player.x + this.player.width / 2}px;
            bottom: ${this.player.y + this.player.height}px;
            color: ${color};
            font-size: ${fontSize};
            font-weight: bold;
            text-shadow: 0 0 5px #000;
            z-index: 100;
            animation: pointsFloat 1.5s ease-out forwards;
            pointer-events: none;
        `;

            this.gameWorld.appendChild(pointsPopup);

            setTimeout(() => {
                pointsPopup.remove();
            }, 1500);
        }

        enemyDestroyed(enemy, killer = 'player') {
            // Calcula pontos baseados no tipo de inimigo
            let points = CONFIG.POINTS_PER_ENEMY;

            if (enemy.width === 250) { // Inimigo grande
                points *= 2;
            } else if (enemy.typeName === 'flyer') {
                points *= 1.5;
            } else if (enemy.typeName === 'sky_faller') {
                points *= 1.2;
            }

            // Adiciona pontos
            this.addPoints(points, enemy);

            // Adiciona carga especial (mantém o existente)
            this.addSpecialCharge(1);
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
                { x: 1500, y: 450, type: 'sky_faller', active: true }, // Novo
                { x: 2000, y: 400, type: 'sky_faller', active: true },
                { x: 2500, y: 500, type: 'sky_faller', active: true }, // Novo
                { x: 3000, y: 450, type: 'sky_faller', active: true },
                { x: 3500, y: 400, type: 'sky_faller', active: true }, // Novo
                { x: 4500, y: 500, type: 'sky_faller', active: true }, // Novo
                // Flyers (Naves)
                { x: 1800, y: 400, type: 'flyer', active: true },
                { x: 2800, y: 350, type: 'flyer', active: true },
                { x: 3800, y: 450, type: 'flyer', active: true },
                // Adicione quantos quiser
            ];

            // Você pode também definir grupos de spawn
            this.spawnGroups = [
                {
                    name: 'primeira_onda',
                    points: [
                        { x: 2200, y: 500, type: 'sky_faller' },
                        { x: 2250, y: 450, type: 'sky_faller' },
                        { x: 2300, y: 300, type: 'flyer' }, // Flyer na onda 1
                        { x: 2600, y: 400, type: 'sky_faller' }
                    ],
                    activated: false
                },
                {
                    name: 'segunda_onda',
                    points: [
                        { x: 3200, y: 550, type: 'sky_faller' },
                        { x: 3250, y: 450, type: 'sky_faller' },
                        { x: 3400, y: 450, type: 'sky_faller' },
                        { x: 3300, y: 250, type: 'flyer' }, // Flyer alto
                        { x: 3450, y: 500, type: 'sky_faller' }
                    ],
                    activated: false
                },
                {
                    name: 'terceira_onda',
                    points: [
                        { x: 4200, y: 500, type: 'sky_faller' },
                        { x: 4250, y: 350, type: 'flyer' }, // Flyer
                        { x: 4300, y: 450, type: 'sky_faller' },
                        { x: 4350, y: 350, type: 'flyer' }, // Flyer
                        { x: 4400, y: 500, type: 'sky_faller' }
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

        createBossBarriers() {
            if (this.bossBarriers.length > 0) return; // Evita criar duplicatas

            // Barreira esquerda
            const leftBarrier = document.createElement('div');
            leftBarrier.className = 'boss-barrier';
            leftBarrier.style.cssText = `
            position: absolute;
            left: ${this.bossArena.leftBoundary - 250}px;
            bottom: -31px;
            width: 600px;
            height: 600px;
            background-image: url('${ASSETS.boss_barrier || ASSETS.arvore}');
            background-size: 100% 100%;
            z-index: 28;
            pointer-events: none;
            transform: scaleX(-1); // Espelhar para parecer diferente
        `;

            // Barreira direita
            const rightBarrier = document.createElement('div');
            rightBarrier.className = 'boss-barrier';
            rightBarrier.style.cssText = `
            position: absolute;
            left: ${this.bossArena.rightBoundary - 50}px;
             bottom: -31px;
            width: 600px;
            height: 600px;
            background-image: url('${ASSETS.boss_barrier || ASSETS.arvore}');
            background-repeat: repeat-y;
            background-size: contain;
            z-index: 28;
            pointer-events: none;
        `;

            this.gameWorld.appendChild(leftBarrier);
            this.gameWorld.appendChild(rightBarrier);
            this.bossBarriers.push(leftBarrier, rightBarrier);

            console.log('Barreiras visuais do boss criadas!');
        }

        // Método para remover barreiras
        removeBossBarriers() {
            this.bossBarriers.forEach(barrier => {
                if (barrier.parentElement) {
                    barrier.remove();
                }
            });
            this.bossBarriers = [];
        }

        createPits() {
            // Cria elementos visuais para os buracos
            LEVEL_DATA.pits.forEach(pitData => {
                const pit = {
                    x: pitData.x,
                    y: pitData.y,
                    width: pitData.width,
                    height: pitData.height,
                    element: null,
                    image: pitData.image // Armazena a URL da imagem
                };

                // Cria elemento visual para o buraco com imagem
                const pitElement = document.createElement('div');
                pitElement.className = 'pit';

                // Se houver imagem, use-a como background
                if (pit.image) {
                    // Primeiro, pré-carrega a imagem
                    const img = imageCache.getImage(pit.image);

                    pitElement.style.cssText = `
                position: absolute;
                left: ${pit.x}px;
                bottom: ${pit.y}px;
                width: ${pit.width}px;
                height: ${pit.height}px;
                background-image: url('${pit.image}');
                background-size: cover; /* Ou 'contain' dependendo do efeito desejado */
                background-position: center;
                background-repeat: no-repeat;
                z-index: 15;
                pointer-events: auto; /* Importante para colisão */
            `;
                } else {
                    // Fallback visual para debug (opcional)
                    pitElement.style.cssText = `
                position: absolute;
                left: ${pit.x}px;
                bottom: ${pit.y}px;
                width: ${pit.width}px;
                height: ${pit.height}px;
                background: rgba(0, 0, 0, 0.5);
                z-index: 15;
                border-top: 2px dashed red;
            `;
                }

                this.gameWorld.appendChild(pitElement);
                pit.element = pitElement;

                this.pits.push(pit);
            });
        }
        checkPitCollisions() {
            if (this.isRespawning) return;

            const playerHitbox = this.player.getHitbox();

            // Verificar colisão do jogador com cada buraco
            for (const pit of this.pits) {
                // Player vs buraco
                if (!this.player.isInvulnerable && checkCollisionRect(playerHitbox, pit)) {
                    console.log("Player colidiu com buraco!");
                    this.playerFallsInPit();
                    break; // Sair após encontrar primeira colisão
                }

                // Inimigos vs buraco
                this.checkEnemiesInPits(pit);

                // Projéteis vs buraco
                this.checkProjectilesInPits(pit);
            }
        }

        checkEnemiesInPits(pit) {
            // Usar loop reverso para evitar problemas ao remover elementos
            for (let i = this.enemies.length - 1; i >= 0; i--) {
                const enemy = this.enemies[i];

                // Pular inimigos que já estão marcados para deleção
                if (enemy.isMarkedForDeletion || enemy.isParalyzed) continue;

                const enemyHitbox = enemy.getHitbox();
                if (!enemyHitbox) continue;

                // Usar checkCollisionRect para consistência
                if (checkCollisionRect(pit, enemyHitbox)) {
                    console.log(`💀 Inimigo caiu no buraco! Tipo: ${enemy.typeName}`);

                    // Aplicar dano
                    const damageTaken = enemy.takeDamage(CONFIG.PIT_DAMAGE_TO_ENEMIES, 'pit');

                    // Efeito visual
                    this.createPitEffect(enemy.x, enemy.y, 'enemy');

                    // Adicionar pontos se o inimigo morreu
                    if (damageTaken && enemy.currentHealth <= 0) {
                        this.addPoints(CONFIG.POINTS_PER_ENEMY, 'pit_kill');
                    }
                }
            }
        }


        createPitEffect(x, y, type) {
            const effect = document.createElement('div');
            effect.className = 'pit-effect';

            effect.style.cssText = `
        position: absolute;
        left: ${x}px;
        bottom: ${y}px;
        width: 50px;
        height: 50px;
        background: radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 70%);
        z-index: 20;
        animation: pitEffect 0.5s ease-in-out;
    `;

            this.gameWorld.appendChild(effect);

            // Remove o efeito após a animação
            setTimeout(() => {
                effect.remove();
            }, 500);
        }

        enemyFallsInPit(enemy, pit) {
            console.log(`💀 Inimigo caiu no buraco em (${pit.x}, ${pit.y})!`);

            // Aplica dano ao inimigo
            const damageTaken = enemy.takeDamage(CONFIG.PIT_DAMAGE_TO_ENEMIES, 'pit');

            // Efeito visual
            this.createPitEffect(enemy.x, enemy.y, 'enemy');

            if (damageTaken && enemy.currentHealth <= 0) {
                console.log(`🎯 Inimigo eliminado pelo buraco!`);
                // Adiciona pontos por eliminar inimigo no buraco (opcional)
                this.addPoints(CONFIG.POINTS_PER_ENEMY * 0.5, 'pit_kill');
            }
        }


        playerFallsInPit() {
            if (this.isRespawning) return;

            console.log("💀 Player caiu em um buraco!");

            // Aplica dano ao player
            const damageTaken = this.player.takeDamage(CONFIG.PIT_DAMAGE);

            if (damageTaken) {
                // Inicia processo de respawn
                this.startRespawn();
            }
        }

        startRespawn() {
            this.isRespawning = true;
            this.respawnTimer = CONFIG.RESPAWN_DELAY;

            // Efeito visual de queda
            this.player.element.style.opacity = '0.5';
            this.player.element.style.filter = 'blur(2px)';

            // Congela controles temporariamente
            this.player.isParalyzed = true;

            console.log("🔄 Iniciando respawn...");
        }

        updateRespawn(deltaTime) {
            if (!this.isRespawning) return;

            this.respawnTimer -= deltaTime;

            if (this.respawnTimer <= 0) {
                this.completeRespawn();
            }
        }

        createRespawnEffect(x, y) {
            const effect = document.createElement('div');
            effect.className = 'respawn-effect';
            effect.style.cssText = `
            position: absolute;
            left: ${x - 50}px;
            bottom: ${y - 50}px;
            width: 100px;
            height: 100px;
            background: radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 70%);
            border-radius: 50%;
            pointer-events: none;
            z-index: 100;
        `;

            this.gameWorld.appendChild(effect);

            // Remove após animação
            setTimeout(() => {
                if (effect.parentElement) {
                    effect.remove();
                }
            }, 500);
        }

        completeRespawn() {
            // Encontra uma posição segura para respawn
            const safePosition = this.findSafeRespawnPosition();
            this.createRespawnEffect(safePosition.x, safePosition.y);

            // Reseta a posição do player
            this.player.x = safePosition.x;
            this.player.y = safePosition.y;
            this.player.velocityX = 0;
            this.player.velocityY = 0;

            // Restaura aparência do player
            this.player.element.style.opacity = '1';
            this.player.element.style.filter = 'none';

            // Remove paralisia
            this.player.isParalyzed = false;

            // Finaliza respawn
            this.isRespawning = false;

            // Aplica invulnerabilidade temporária após respawn
            this.player.isInvulnerable = true;
            this.player.element.classList.add('invulnerable');

            setTimeout(() => {
                this.player.isInvulnerable = false;
                this.player.element.classList.remove('invulnerable');
            }, CONFIG.INVULNERABILITY_DURATION);

            console.log(`✅ Player respawned em (${safePosition.x}, ${safePosition.y})`);
        }

        findSafeRespawnPosition() {
            // Tenta encontrar uma posição segura próxima ao buraco
            // ou usa a posição padrão de respawn

            // Verifica se há alguma plataforma próxima
            for (const platform of this.platforms) {
                // Encontra uma plataforma sólida não muito longe
                if (platform.y > 50 && platform.width > 100) {
                    return {
                        x: platform.x + platform.width / 2,
                        y: platform.y + platform.height
                    };
                }
            }

            // Fallback para posição padrão
            return {
                x: this.player.x > 0 ? this.player.x - 200 : 100,
                y: 100
            };
        }

        update(deltaTime) {
            if (this.isGameOver) return;
            this.updateRespawn(deltaTime);
            
            if (this.parallaxSystem) {
            this.parallaxSystem.update(this.player.x, this.worldX);
        }

            // Verifica colisões com buracos (apenas se não estiver respawnando)
            if (!this.isRespawning) {
                this.checkPitCollisions();
            }

            if (!this.bossArena.active && !this.bossArena.isResolved && this.player.x > this.bossArena.xTrigger) {
                this.bossArena.active = true;
                const bossUI = document.getElementById('boss-ui');
                if (bossUI) bossUI.style.display = 'block';

                this.createBossBarriers();

                if (this.boss) {
                    this.boss.stateMachine.setState('activating');
                }
            }

            if (this.bossArena.active) {
                if (this.player.x < this.bossArena.leftBoundary) {
                    this.player.x = this.bossArena.leftBoundary;
                    this.player.velocityX = 0;
                }
                if (this.player.x > this.bossArena.rightBoundary) {
                    this.player.x = this.bossArena.rightBoundary;
                    this.player.velocityX = 0;
                }

                if (this.boss) {
                    const healthBar = document.getElementById('boss-health-bar');
                    if (healthBar) {
                        const percent = (this.boss.health / this.boss.maxHealth) * 100;
                        healthBar.style.width = percent + "%";
                    }

                    if (this.boss.isDead) {
                        this.bossArena.active = false;
                        this.bossArena.isResolved = true;
                        const bossUI = document.getElementById('boss-ui');
                        if (bossUI) setTimeout(() => bossUI.style.display = 'none', 2000);
                    }
                }
            }

            this.controls.update();
            this.player.update(deltaTime, this.controls, this.platforms);

            if (this.boss) {
                this.boss.update(deltaTime);
                const bossHitbox = this.boss.getHitbox();

                this.playerProjectiles.forEach(p => {
                    if (bossHitbox && checkCollision(p.getHitbox(), bossHitbox)) {
                        this.boss.takeDamage(p.damage);
                        p.destroy();
                    }
                });
            }

            // SPAWN MAIS RÁPIDO E DINÂMICO
            this.enemySpawnTimer += deltaTime;
            if (this.enemySpawnTimer > CONFIG.ENEMY_SPAWN_INTERVAL &&
                this.enemies.length < CONFIG.MAX_ENEMIES_ON_SCREEN) {

                this.enemySpawnTimer = 0;

                // Spawn múltiplos inimigos de uma vez
                const spawnCount = Math.min(
                    CONFIG.WAVE_SPAWN_COUNT,
                    CONFIG.MAX_ENEMIES_ON_SCREEN - this.enemies.length
                );

                for (let i = 0; i < spawnCount; i++) {
                    this.spawnRandomEnemy();
                }

                // Reduz o intervalo de spawn progressivamente
                if (this.enemies.length > CONFIG.MAX_ENEMIES_ON_SCREEN * 0.7) {
                    CONFIG.ENEMY_SPAWN_INTERVAL = Math.max(300, CONFIG.ENEMY_SPAWN_INTERVAL - 50);
                }
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
                        const distanceToPlayer = Math.abs(this.player.x - point.x);

                        if (distanceToPlayer < 200) { // Reduzido de 300 para 200
                            this.spawnEnemyAtPoint(point);
                            point.active = false;
                        }
                    }
                });

                if (this.player.x > 800 && !this.spawnGroups[0].activated) { // Reduzido de 1000 para 800
                    this.spawnEnemyGroup('primeira_onda');
                }

                if (this.player.x > 1500 && !this.spawnGroups[1].activated) { // Reduzido de 2000 para 1500
                    this.spawnEnemyGroup('segunda_onda');
                }

                if (this.player.x > 2500 && !this.spawnGroups[2]?.activated) { // Nova onda
                    this.spawnEnemyGroup('terceira_onda');
                }

                const playerAttackHitbox = this.player.getAttackHitbox();
                if (playerAttackHitbox) {
                    this.enemies.forEach(e => {
                        if (!this.player.enemiesHitInCurrentAttack.has(e)) {
                            if (checkCollision(playerAttackHitbox, e.getHitbox())) {

                                const weapon = WEAPONS[this.player.equippedWeapon];
                                const damage = weapon.damage || 1;

                                const enemyDied = e.takeDamage(damage, this.player);

                                const knockbackDir = this.player.direction;
                                e.applyKnockback(knockbackDir, 10);

                                this.player.enemiesHitInCurrentAttack.add(e);

                                if (enemyDied) {
                                    this.addSpecialCharge(1);
                                }
                            }
                        }
                    });
                } else {
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
                    if (i instanceof PointsPickup) {
                        this.addPoints(i.pointsValue, 'pickup');
                        i.destroy();
                    } else {
                        this.player.collectWeapon(i.weaponKey);
                        i.destroy();
                    }
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

            const minX = -6200 + CONFIG.GAME_WIDTH;
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
                    zIndex: '27'
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
            this.boss = new Boss(5300, 0, this); // Posicionado no X = 5000
            this.gameWorld.appendChild(this.boss.element);
            this.loop(0);
        }
    }

    // Iniciar o jogo
    const game = new Game();
    game.start();
});