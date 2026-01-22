    const viewport = document.getElementById('viewport');
    const enemyHpBar = document.getElementById('enemy-hp');
    const playerHpBar = document.getElementById('player-hp');
    const playerHpNum = document.getElementById('player-hp-num');
    const battleMessage = document.getElementById('battle-message');
    const mainPanel = document.getElementById('main-panel');
    const fightPanel = document.getElementById('fight-panel');
    const itemsPanel = document.getElementById('items-panel');
    const playerCreature = document.getElementById('player-creature');
    const enemyCreature = document.getElementById('enemy-creature');
    const impactFlash = document.getElementById('impact-flash');

    // DMG/GBC Mode Toggle
    const gameboyShell = document.getElementById('gameboy-shell');
    const powerSwitch = document.getElementById('power-switch');
    const gameboyLabel = document.getElementById('gameboy-label');

    powerSwitch.addEventListener('click', () => {
      const goingToColor = gameboyShell.classList.contains('dmg-mode');

      if (goingToColor) {
        // Color burst shader: DMG → Color
        viewport.classList.add('mode-transition-color');

        setTimeout(() => {
          powerSwitch.classList.toggle('on');
          gameboyShell.classList.toggle('dmg-mode');
          gameboyLabel.innerHTML = 'GAME BOY <span>COLOR</span>';
        }, 75);

        setTimeout(() => {
          viewport.classList.remove('mode-transition-color');
        }, 300);
      } else {
        // LCD drain shader: Color → DMG
        viewport.classList.add('mode-transition-drain');

        setTimeout(() => {
          powerSwitch.classList.toggle('on');
          gameboyShell.classList.toggle('dmg-mode');
          gameboyLabel.innerHTML = 'GAME BOY';
          viewport.classList.remove('mode-transition-drain');
        }, 350);
      }
    });

    let playerHp = 100;
    let enemyHp = 100;
    let playerLevel = 50;
    let playerExp = 0;
    let currentMenu = 'main';
    let isAnimating = false;
    let currentEnemy = 0;

    // Status effects
    let playerStatus = null; // 'burn' or 'poison'
    const STATUS_CHANCE = 0.30; // 30% chance

    function applyStatusEffect(status) {
      if (playerStatus) return; // Already has a status
      if (Math.random() > STATUS_CHANCE) return; // 30% chance

      playerStatus = status;
      playerCreature.classList.add(status === 'burn' ? 'burning' : 'poisoned');

      // Add status icon to player stat box
      const statName = document.querySelector('.stat-box.player .stat-name');
      if (!statName.querySelector('.status-icon')) {
        const icon = document.createElement('span');
        icon.className = `status-icon ${status}`;
        icon.textContent = status === 'burn' ? 'BRN' : 'PSN';
        statName.appendChild(icon);
      }
    }

    function processStatusDamage(callback) {
      if (!playerStatus || playerHp <= 0) {
        callback();
        return;
      }

      const statusDmg = Math.floor(playerHp * 0.08); // 8% of current HP
      const statusName = playerStatus === 'burn' ? 'burn' : 'poison';

      showMessage(`SWEETBUN is hurt<br>by its ${statusName}!`);

      setTimeout(() => {
        playerHp = Math.max(1, playerHp - statusDmg); // Don't kill from status
        updateHpBar(playerHpBar, playerHp, true);
        vibrateOnDamage();

        const rect = playerCreature.getBoundingClientRect();
        const vRect = viewport.getBoundingClientRect();
        const x = rect.left - vRect.left + rect.width / 2;
        const y = rect.top - vRect.top + rect.height / 2;

        showDamage(x, y - 30, statusDmg);
        spawnParticleBurst(playerStatus === 'burn' ? 'ember' : 'sludge', x, y, 5, 20);

        setTimeout(callback, 600);
      }, 800);
    }

    function clearPlayerStatus() {
      playerStatus = null;
      playerCreature.classList.remove('burning', 'poisoned');
      const icon = document.querySelector('.stat-box.player .status-icon');
      if (icon) icon.remove();
    }

    const enemies = [
      { name: 'SPECTER', level: 50, hp: 100, maxHp: 100, exp: 150, sprite: 'void', type: 'GHOST', attack: 'SHADOW SNEAK', damage: [10, 18] },
      { name: 'MOLDSPORE', level: 52, hp: 110, maxHp: 110, exp: 170, sprite: 'moldspore', type: 'POISON', attack: 'TOXIC SPORE', damage: [10, 16], shader: 'toxic' },
      { name: 'CRYSTOWL', level: 54, hp: 130, maxHp: 130, exp: 200, sprite: 'crystowl', type: 'ICE', attack: 'FROST WING', damage: [14, 22], shader: 'ice' },
      { name: 'SLIME', level: 56, hp: 140, maxHp: 140, exp: 220, sprite: 'slime', type: 'POISON', attack: 'SLUDGE BOMB', damage: [14, 22] },
      { name: 'INFERNO', level: 58, hp: 160, maxHp: 160, exp: 280, sprite: 'inferno', type: 'FIRE', attack: 'FLAME BURST', damage: [16, 26] }
    ];

    // Type effectiveness
    function getTypeMultiplier(moveType, enemyType) {
      const chart = {
        'FIRE': { 'FIRE': 0.5, 'GHOST': 1, 'POISON': 1, 'ICE': 2 },
        'GHOST': { 'GHOST': 2, 'FIRE': 1, 'POISON': 1, 'ICE': 1 },
        'DARK': { 'GHOST': 2, 'FIRE': 1, 'POISON': 1, 'ICE': 1 },
        'ICE': { 'FIRE': 0.5, 'ICE': 0.5, 'GHOST': 1, 'POISON': 1 }
      };
      return chart[moveType]?.[enemyType] || 1;
    }

    const moves = {
      'crunch': { pp: 15, maxPp: 15, type: 'DARK', power: 20, particles: 'crunch' },
      'flamethrower': { pp: 15, maxPp: 15, type: 'FIRE', power: 25, particles: 'flamethrower' },
      'shadow-ball': { pp: 15, maxPp: 15, type: 'GHOST', power: 20, particles: 'shadow' },
      'fire-blast': { pp: 5, maxPp: 5, type: 'FIRE', power: 35, particles: 'blast' }
    };

    const items = {
      'potion': { count: 3, heal: 20, particles: 'heal' },
      'burn-heal': { count: 2, heal: 0, particles: 'burn-cure', cures: 'burn' },
      'antidote': { count: 2, heal: 0, particles: 'antidote', cures: 'poison' }
    };

    // Particle system
    function spawnParticle(type, x, y, extraStyles = {}) {
      const p = document.createElement('div');
      p.className = `particle ${type}-particle`;
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      Object.assign(p.style, extraStyles);
      viewport.appendChild(p);
      setTimeout(() => p.remove(), 1200);
    }

    function spawnParticleBurst(type, x, y, count, spread) {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 / count) * i;
        const dist = spread * (0.5 + Math.random() * 0.5);
        const px = x + Math.cos(angle) * dist;
        const py = y + Math.sin(angle) * dist;
        const delay = Math.random() * 100;
        setTimeout(() => spawnParticle(type, px, py, {
          '--dx': (Math.random() - 0.5) * 40 + 'px'
        }), delay);
      }
    }

    function spawnHealParticles(type, targetEl, count) {
      const rect = targetEl.getBoundingClientRect();
      const viewRect = viewport.getBoundingClientRect();
      const cx = rect.left - viewRect.left + rect.width / 2;
      const cy = rect.top - viewRect.top + rect.height / 2;

      for (let i = 0; i < count; i++) {
        const delay = i * 80;
        const x = cx + (Math.random() - 0.5) * 60;
        const y = cy + (Math.random() - 0.5) * 60;
        setTimeout(() => {
          if (type === 'max-heal') {
            const hue = (i / count) * 360;
            spawnParticle(type, x, y, {
              background: `hsl(${hue}, 100%, 60%)`,
              boxShadow: `0 0 15px hsl(${hue}, 100%, 70%)`
            });
          } else {
            spawnParticle(type, x, y);
          }
        }, delay);
      }
    }

    function screenShake() {
      viewport.classList.add('shake');
      setTimeout(() => viewport.classList.remove('shake'), 300);
    }

    function triggerImpactFlash() {
      impactFlash.classList.remove('active');
      void impactFlash.offsetWidth;
      impactFlash.classList.add('active');
    }

    function vibrateOnDamage() {
      if (navigator.vibrate) {
        navigator.vibrate([50, 30, 80]); // Short pattern: hit, pause, rumble
      }
    }

    function triggerCritFlash() {
      viewport.classList.add('crit-flash');
      setTimeout(() => viewport.classList.remove('crit-flash'), 250);
    }

    function createScreenSplat() {
      const splat = document.createElement('div');
      splat.className = 'screen-splat';

      // Create random splat blobs
      for (let i = 0; i < 5; i++) {
        const blob = document.createElement('div');
        blob.className = 'splat-blob';
        const size = 30 + Math.random() * 50;
        blob.style.width = size + 'px';
        blob.style.height = size * (0.6 + Math.random() * 0.4) + 'px';
        blob.style.left = (Math.random() * 80 + 10) + '%';
        blob.style.top = (Math.random() * 60 + 10) + '%';
        blob.style.transform = `rotate(${Math.random() * 360}deg)`;
        splat.appendChild(blob);

        // Add drips
        const dripCount = Math.floor(Math.random() * 3) + 1;
        for (let j = 0; j < dripCount; j++) {
          const drip = document.createElement('div');
          drip.className = 'splat-drip';
          drip.style.width = (4 + Math.random() * 6) + 'px';
          drip.style.height = (15 + Math.random() * 20) + 'px';
          drip.style.left = (parseFloat(blob.style.left) + Math.random() * 10 - 5) + '%';
          drip.style.top = (parseFloat(blob.style.top) + size * 0.3 / 5) + '%';
          drip.style.animationDelay = (Math.random() * 0.3) + 's';
          splat.appendChild(drip);
        }
      }

      viewport.appendChild(splat);
      splat.classList.add('active');
      setTimeout(() => splat.remove(), 2500);
    }

    function showMenu(menu) {
      if (isAnimating) return;
      currentMenu = menu;
      mainPanel.style.display = menu === 'main' ? 'flex' : 'none';
      fightPanel.classList.toggle('active', menu === 'fight');
      itemsPanel.classList.toggle('active', menu === 'items');
    }

    function updateHpBar(bar, hp, isPlayer) {
      const currentWidth = parseFloat(bar.style.width) || 100;
      const targetWidth = Math.max(0, hp);
      const duration = 400; // ms
      const startTime = performance.now();

      function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const currentHp = currentWidth + (targetWidth - currentWidth) * eased;

        bar.style.width = currentHp + '%';

        bar.classList.remove('medium', 'low');
        if (currentHp <= 20) bar.classList.add('low');
        else if (currentHp <= 50) bar.classList.add('medium');

        if (isPlayer) playerHpNum.textContent = Math.max(0, Math.round(currentHp));

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      }

      requestAnimationFrame(animate);
    }

    function showMessage(msg) {
      battleMessage.innerHTML = msg;
    }

    // Pokemon-style announcement box
    const announceBox = document.getElementById('announce-box');
    const announceText = document.getElementById('announce-text');
    let announceQueue = [];
    let isAnnouncing = false;

    function showAnnounce(messages, callback) {
      // messages can be a single string or array of strings
      const msgArray = Array.isArray(messages) ? messages : [messages];
      announceQueue = msgArray;
      isAnnouncing = true;
      showNextAnnounce(callback);
    }

    function showNextAnnounce(callback) {
      if (announceQueue.length === 0) {
        announceBox.classList.remove('visible');
        isAnnouncing = false;
        if (callback) callback();
        return;
      }

      const msg = announceQueue.shift();
      announceText.innerHTML = msg;
      announceBox.classList.add('visible');

      // Tap to continue
      const handleTap = (e) => {
        e.stopPropagation();
        announceBox.removeEventListener('click', handleTap);
        viewport.removeEventListener('click', handleTap);
        showNextAnnounce(callback);
      };

      setTimeout(() => {
        announceBox.addEventListener('click', handleTap);
        viewport.addEventListener('click', handleTap);
      }, 300);
    }

    function createProjectile(fromX, fromY, toX, toY, type, onHit) {
      const proj = document.createElement('div');
      proj.className = `projectile ${type}`;
      proj.style.left = fromX + 'px';
      proj.style.top = fromY + 'px';
      viewport.appendChild(proj);

      // Trail particles
      const trailInterval = setInterval(() => {
        const currentX = parseFloat(proj.style.left);
        const currentY = parseFloat(proj.style.top);
        if (type === 'void') {
          spawnParticle('void', currentX, currentY);
        } else if (type === 'shadow-ball') {
          spawnParticle('shadow', currentX, currentY);
        } else if (type === 'sludge') {
          spawnParticle('sludge', currentX + (Math.random() - 0.5) * 12, currentY + (Math.random() - 0.5) * 12);
        } else if (type === 'ice') {
          spawnParticle('ice', currentX + (Math.random() - 0.5) * 8, currentY + (Math.random() - 0.5) * 8);
        } else if (type === 'spore') {
          spawnParticle('spore', currentX + (Math.random() - 0.5) * 15, currentY + (Math.random() - 0.5) * 15, {
            '--spore-drift': ((Math.random() - 0.5) * 30) + 'px'
          });
        } else {
          spawnParticle('fire', currentX + (Math.random() - 0.5) * 10, currentY + (Math.random() - 0.5) * 10);
        }
      }, 50);

      const duration = type === 'fire-blast' ? 400 : 300;
      const startTime = Date.now();

      function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        proj.style.left = fromX + (toX - fromX) * eased + 'px';
        proj.style.top = fromY + (toY - fromY) * eased + 'px';

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          clearInterval(trailInterval);
          proj.remove();
          if (onHit) onHit();
        }
      }
      animate();
    }

    function showDamage(x, y, amount, isCrit = false, isHeal = false) {
      const dmg = document.createElement('div');
      dmg.className = 'damage-num' + (isCrit ? ' crit' : '') + (isHeal ? ' heal' : '');
      dmg.textContent = (isHeal ? '+' : '') + amount;
      dmg.style.left = x + 'px';
      dmg.style.top = y + 'px';
      viewport.appendChild(dmg);
      setTimeout(() => dmg.remove(), 1000);
    }

    function hitCreature(creature) {
      creature.classList.add('hit');
      setTimeout(() => creature.classList.remove('hit'), 400);
    }

    function useMove(moveName) {
      if (isAnimating) return;
      const move = moves[moveName];
      if (!move || move.pp <= 0) return;

      isAnimating = true;
      move.pp--;
      // Update PP display
      document.getElementById('move-pp').textContent = `PP ${move.pp}/${move.maxPp}`;
      const displayName = moveName.replace('-', ' ').toUpperCase();
      showMessage(`SWEETBUN used<br>${displayName}!`);
      showMenu('main');

      const playerRect = playerCreature.getBoundingClientRect();
      const enemyRect = enemyCreature.getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();

      const fromX = playerRect.left - viewportRect.left + playerRect.width / 2;
      const fromY = playerRect.top - viewportRect.top + playerRect.height / 2;
      const toX = enemyRect.left - viewportRect.left + enemyRect.width / 2;
      const toY = enemyRect.top - viewportRect.top + enemyRect.height / 2;

      // Charge up particles
      setTimeout(() => {
        spawnParticleBurst('ember', fromX, fromY, 8, 30);
      }, 200);

      setTimeout(() => {
        createProjectile(fromX, fromY, toX, toY, moveName, () => {
          hitCreature(enemyCreature);
          screenShake();
          triggerImpactFlash();

          const isCrit = Math.random() < 0.15;
          const isEvolved = playerCreature.querySelector('div').classList.contains('flame-sprite');
          const evoBonus = isEvolved ? 200 : 0; // BAGUETTE one-shots!
          const enemy = enemies[currentEnemy];
          const typeMultiplier = getTypeMultiplier(move.type, enemy.type);
          let damage = Math.floor((move.power + Math.floor(Math.random() * 10) + (isCrit ? 15 : 0)) * typeMultiplier) + evoBonus;
          enemyHp = Math.max(0, enemyHp - damage);
          updateHpBar(enemyHpBar, (enemyHp / enemy.maxHp) * 100, false);
          showDamage(toX, toY - 30, damage, isCrit);

          // Critical hit shader
          if (isCrit) {
            triggerCritFlash();
          }

          // Impact particles based on move type
          if (move.particles === 'blast') {
            spawnParticleBurst('blast', toX, toY, 12, 50);
            spawnParticleBurst('fire', toX, toY, 20, 70);
          } else if (move.particles === 'flamethrower') {
            spawnParticleBurst('flame-stream', toX, toY, 10, 40);
          } else if (move.particles === 'shadow') {
            spawnParticleBurst('shadow', toX, toY, 15, 45);
          } else if (move.particles === 'crunch') {
            spawnParticleBurst('crunch', toX, toY, 8, 30);
          } else {
            spawnParticleBurst('ember', toX, toY, 8, 35);
          }

          if (enemyHp <= 0) {
            const enemy = enemies[currentEnemy];
            enemyCreature.classList.add('fainting');

            // Award EXP
            const expGain = enemy.exp;
            playerExp += expGain;
            const expPercent = Math.min(100, (playerExp % 300) / 3);
            document.getElementById('exp-bar').style.width = expPercent + '%';

            // Build announcement messages
            const announcements = [`Wild ${enemy.name}<br>fainted!`, `SWEETBUN gained<br>${expGain} EXP!`];

            // Level up check
            let didLevelUp = false;
            if (playerExp >= 300) {
              playerExp = playerExp % 300;
              playerLevel++;
              didLevelUp = true;
              announcements.push(`SWEETBUN grew to<br>Lv${playerLevel}!`);
            }

            showAnnounce(announcements, () => {
              if (didLevelUp) {
                document.querySelector('.stat-box.player .stat-level').textContent = playerLevel;
                spawnHealParticles('max-heal', playerCreature, 15);
              }

              // Check for next enemy
              if (currentEnemy < enemies.length - 1) {
                currentEnemy++;
                const nextEnemy = enemies[currentEnemy];
                showAnnounce(`Trainer sends out<br>${nextEnemy.name}!`, () => {
                  // Update enemy stats
                  document.querySelector('.stat-box.enemy .stat-name').textContent = nextEnemy.name;
                  document.querySelector('.stat-box.enemy .stat-level').textContent = nextEnemy.level;

                  // Swap sprite
                  const spriteContainer = enemyCreature.querySelector('div');
                  spriteContainer.className = nextEnemy.sprite + '-sprite';

                  enemyHp = nextEnemy.maxHp;
                  updateHpBar(enemyHpBar, 100, false);

                  enemyCreature.classList.remove('fainting');
                  enemyCreature.classList.add('appearing');

                  setTimeout(() => {
                    enemyCreature.classList.remove('appearing');
                    isAnimating = false;
                    showMessage('What will<br>SWEETBUN do?');
                  }, 1000);
                });
              } else {
                // All enemies defeated - Pokemon-style victory!
                isAnimating = true;
                const totalExp = enemies.reduce((sum, e) => sum + e.exp, 0);
                const prizeMoney = 3600;
                const playerSpriteContainer = playerCreature.querySelector('div');
                const willEvolve = playerSpriteContainer.classList.contains('sweetbun-sprite');

                // Step 1: Victory announcement
                showAnnounce('Player defeated<br>TRAINER GHOST!', () => {

                  // Step 2: Trainer Ghost appears
                  const trainerOverlay = document.createElement('div');
                  trainerOverlay.className = 'trainer-overlay';
                  trainerOverlay.innerHTML = `
                    <div class="trainer-sprite-container">
                      <div class="creature-sprite">
                        <div class="trainer-ghost-sprite">
                          <div class="pixel-sprite"></div>
                        </div>
                      </div>
                    </div>
                  `;
                  viewport.appendChild(trainerOverlay);

                  setTimeout(() => {
                    // Step 3: Trainer one-liner
                    showAnnounce([
                      'TRAINER GHOST:<br>"Impressive..."',
                      '"Your bond with your<br>partner is strong."',
                      '"Until we meet<br>again..."'
                    ], () => {
                      // Trainer fades away
                      trainerOverlay.style.transition = 'opacity 1s';
                      trainerOverlay.style.opacity = '0';
                      setTimeout(() => trainerOverlay.remove(), 1000);

                      // Step 4: EXP and Money
                      setTimeout(() => {
                        showAnnounce([
                          `SWEETBUN gained<br>${totalExp} total EXP!`,
                          `Got $${prizeMoney}<br>for winning!`
                        ], () => {
                          spawnHealParticles('super-heal', playerCreature, 12);

                          // Step 5: Evolution (last thing!)
                          if (willEvolve) {
                            setTimeout(() => {
                              showAnnounce('What?<br>SWEETBUN is evolving!', () => {
                                // Hide UI for evolution focus
                                viewport.classList.add('evolution-mode');
                                playerCreature.classList.add('evo-flashing');

                                const rect = playerCreature.getBoundingClientRect();
                                const vRect = viewport.getBoundingClientRect();
                                const cx = rect.left - vRect.left + rect.width / 2;
                                const cy = rect.top - vRect.top + rect.height / 2;

                                const spawnTornado = () => {
                                  for (let i = 0; i < 8; i++) {
                                    setTimeout(() => {
                                      const p = document.createElement('div');
                                      p.className = 'evo-particle';
                                      p.style.left = cx + 'px';
                                      p.style.top = cy + 'px';
                                      p.style.animation = `tornado-spin 1.5s ease-in-out forwards`;
                                      p.style.animationDelay = (i * 0.1) + 's';
                                      viewport.appendChild(p);
                                      setTimeout(() => p.remove(), 2000);
                                    }, i * 60);
                                  }
                                };
                                spawnTornado();
                                setTimeout(spawnTornado, 600);
                                setTimeout(spawnTornado, 1200);

                                setTimeout(() => {
                                  playerSpriteContainer.className = 'flame-sprite';
                                }, 2000);

                                setTimeout(() => {
                                  playerCreature.classList.remove('evo-flashing');
                                  viewport.classList.remove('evolution-mode');
                                  showAnnounce([
                                    'Congratulations!',
                                    'SWEETBUN evolved<br>into BAGUETTE!'
                                  ], () => {
                                    document.querySelector('.stat-box.player .stat-name').textContent = 'BAGUETTE';
                                    spawnHealParticles('super-heal', playerCreature, 20);
                                    showEndingScreen();
                                  });
                                }, 3000);
                              });
                            }, 500);
                          } else {
                            showEndingScreen();
                          }
                        });
                      }, 500);
                    });
                  }, 800);
                });
              }
            });
          } else {
            setTimeout(() => {
              isAnimating = false;
              enemyAttack();
            }, 800);
          }
        });
      }, 500);
    }

    function showEndingScreen() {
      // Set up epic battle scene before capturing
      try {
        const playerSpriteContainer = playerCreature.querySelector('div');
        if (playerSpriteContainer) playerSpriteContainer.className = 'flame-sprite';

        const enemySpriteContainer = enemyCreature.querySelector('div');
        if (enemySpriteContainer) enemySpriteContainer.className = 'inferno-sprite';

        const enemyName = document.querySelector('.stat-box.enemy .stat-name');
        const enemyLevel = document.querySelector('.stat-box.enemy .stat-level');
        const playerName = document.querySelector('.stat-box.player .stat-name');
        if (enemyName) enemyName.textContent = 'INFERNO';
        if (enemyLevel) enemyLevel.textContent = '58';
        if (playerName) playerName.textContent = 'BAGUETTE';

        showMessage('What will<br>BAGUETTE do?');
        showMenu('fight');
      } catch(e) { console.log('Setup error:', e); }

      // Longer delay to let sprites render before capture
      setTimeout(() => {
        const shell = document.querySelector('.gameboy-shell');
        if (!shell) { console.error('Shell not found'); return; }
        if (typeof html2canvas === 'undefined') { console.error('html2canvas not loaded'); return; }
        if (typeof THREE === 'undefined') { console.error('THREE.js not loaded'); return; }

        html2canvas(shell, {
          backgroundColor: null,
          scale: 2,
          logging: false
        }).then(canvas => {
          try {
          // Create Three.js scene
          const container = document.createElement('div');
          container.id = 'three-container';
          document.body.appendChild(container);

          const scene = new THREE.Scene();
          const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
          const renderer = new THREE.WebGLRenderer({ antialias: true });
          renderer.setSize(window.innerWidth, window.innerHeight);
          renderer.setClearColor(0x1a0a00);
          container.appendChild(renderer.domElement);

          // Desk surface
          const deskGeom = new THREE.PlaneGeometry(20, 20);
          const deskMat = new THREE.MeshStandardMaterial({
            color: 0x4a3020,
            roughness: 0.8,
            metalness: 0.1
          });
          const desk = new THREE.Mesh(deskGeom, deskMat);
          desk.rotation.x = -Math.PI / 2;
          desk.position.y = -2;
          scene.add(desk);

          // Wood grain lines
          for (let i = 0; i < 8; i++) {
            const lineGeom = new THREE.PlaneGeometry(20, 0.05);
            const lineMat = new THREE.MeshBasicMaterial({ color: 0x3a2010, transparent: true, opacity: 0.3 });
            const line = new THREE.Mesh(lineGeom, lineMat);
            line.rotation.x = -Math.PI / 2;
            line.position.y = -1.99;
            line.position.z = -8 + i * 2 + Math.random();
            scene.add(line);
          }

          // === 90s RETRO DESK DETAILS ===

          // Stack of textbooks (left side, varied sizes)
          const books = [
            { color: 0x8B0000, w: 1.3, h: 0.18, d: 1.0 },  // Dark red - thick
            { color: 0x00008B, w: 1.2, h: 0.12, d: 0.9 },  // Navy
            { color: 0x2F4F2F, w: 1.25, h: 0.15, d: 0.95 }, // Dark green
            { color: 0x4B0082, w: 1.15, h: 0.10, d: 0.85 }, // Indigo - thin
            { color: 0x8B4513, w: 1.1, h: 0.14, d: 0.88 },  // Brown
          ];
          let bookY = -1.98;
          books.forEach((b, i) => {
            const bookGeom = new THREE.BoxGeometry(b.w, b.h, b.d);
            const bookMat = new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.85 });
            const book = new THREE.Mesh(bookGeom, bookMat);
            bookY += b.h / 2;
            book.position.set(-2.5, bookY, -1.2);
            book.rotation.y = (i % 2 === 0 ? 0.08 : -0.05);
            bookY += b.h / 2 + 0.005;
            scene.add(book);
          });

          // Spiral notebook (open, near books)
          const notebookGeom = new THREE.BoxGeometry(0.8, 0.02, 1.1);
          const notebookMat = new THREE.MeshStandardMaterial({ color: 0xf5f5dc, roughness: 0.95 });
          const notebook = new THREE.Mesh(notebookGeom, notebookMat);
          notebook.position.set(-1.2, -1.98, -0.8);
          notebook.rotation.y = -0.3;
          scene.add(notebook);
          // Spiral binding
          for (let i = 0; i < 8; i++) {
            const spiralGeom = new THREE.TorusGeometry(0.03, 0.008, 6, 12);
            const spiralMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 });
            const spiral = new THREE.Mesh(spiralGeom, spiralMat);
            spiral.position.set(-1.55, -1.97, -1.25 + i * 0.14);
            spiral.rotation.y = Math.PI / 2;
            scene.add(spiral);
          }

          // Pencil cup (right side)
          const cupGeom = new THREE.CylinderGeometry(0.15, 0.12, 0.4, 12);
          const cupMat = new THREE.MeshStandardMaterial({ color: 0x2F4F4F, roughness: 0.7 });
          const cup = new THREE.Mesh(cupGeom, cupMat);
          cup.position.set(2.2, -1.8, -1.5);
          scene.add(cup);
          // Pencils in cup
          const pencilColors = [0xFFD700, 0xFF6347, 0x4169E1];
          for (let i = 0; i < 3; i++) {
            const pencilGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6);
            const pencilMat = new THREE.MeshStandardMaterial({ color: pencilColors[i] });
            const pencil = new THREE.Mesh(pencilGeom, pencilMat);
            pencil.position.set(2.2 + (i - 1) * 0.05, -1.55, -1.5);
            pencil.rotation.z = 0.1 * (i - 1);
            scene.add(pencil);
          }

          // Game cartridges (far left, away from gameboy)
          const carts = [
            { x: -2.8, z: 0.8, rot: 0.4, color: 0x707070, label: 0xFFE4B5 },
            { x: -2.5, z: 1.1, rot: -0.2, color: 0x505050, label: 0xB5FFB5 },
            { x: -2.9, z: 1.4, rot: 0.9, color: 0x606060, label: 0xFFB5B5 },
          ];
          carts.forEach(c => {
            const cartGeom = new THREE.BoxGeometry(0.45, 0.08, 0.55);
            const cartMat = new THREE.MeshStandardMaterial({ color: c.color, roughness: 0.6 });
            const cart = new THREE.Mesh(cartGeom, cartMat);
            cart.position.set(c.x, -1.96, c.z);
            cart.rotation.y = c.rot;
            scene.add(cart);
            // Label sticker
            const labelGeom = new THREE.PlaneGeometry(0.3, 0.35);
            const labelMat = new THREE.MeshBasicMaterial({ color: c.label });
            const label = new THREE.Mesh(labelGeom, labelMat);
            label.position.set(c.x, -1.91, c.z);
            label.rotation.x = -Math.PI / 2;
            label.rotation.z = c.rot;
            scene.add(label);
          });

          // Soda can (near front right)
          const canGeom = new THREE.CylinderGeometry(0.12, 0.12, 0.4, 16);
          const canMat = new THREE.MeshStandardMaterial({ color: 0xCC0000, metalness: 0.7, roughness: 0.3 });
          const sodaCan = new THREE.Mesh(canGeom, canMat);
          sodaCan.position.set(2.8, -1.8, 0.8);
          scene.add(sodaCan);
          // Can top
          const canTopGeom = new THREE.CylinderGeometry(0.11, 0.12, 0.02, 16);
          const canTopMat = new THREE.MeshStandardMaterial({ color: 0xC0C0C0, metalness: 0.9 });
          const canTop = new THREE.Mesh(canTopGeom, canTopMat);
          canTop.position.set(2.8, -1.59, 0.8);
          scene.add(canTop);

          // Coffee mug (bigger, near books)
          const mugX = -1.7, mugZ = -1.6;
          const mugGeom = new THREE.CylinderGeometry(0.22, 0.18, 0.45, 16);
          const mugMat = new THREE.MeshStandardMaterial({ color: 0xf8f8f8, roughness: 0.3 });
          const mug = new THREE.Mesh(mugGeom, mugMat);
          mug.position.set(mugX, -1.76, mugZ);
          scene.add(mug);
          // Mug handle (bigger)
          const handleGeom = new THREE.TorusGeometry(0.12, 0.035, 8, 12, Math.PI);
          const handle = new THREE.Mesh(handleGeom, mugMat);
          handle.position.set(mugX + 0.22, -1.76, mugZ);
          handle.rotation.y = Math.PI / 2;
          handle.rotation.x = Math.PI / 2;
          scene.add(handle);
          // Coffee inside with shader
          const coffeeGeom = new THREE.CircleGeometry(0.19, 32);
          const coffeeVertShader = `
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `;
          const coffeeFragShader = `
            uniform float time;
            varying vec2 vUv;
            void main() {
              vec2 uv = vUv - 0.5;
              float dist = length(uv);

              // Base coffee color
              vec3 coffeeColor = vec3(0.22, 0.13, 0.08);
              vec3 creamColor = vec3(0.35, 0.25, 0.18);

              // Subtle swirl pattern
              float angle = atan(uv.y, uv.x);
              float swirl = sin(angle * 3.0 + dist * 8.0 - time * 0.3) * 0.5 + 0.5;

              // Ripple from center
              float ripple = sin(dist * 20.0 - time * 0.8) * 0.02;

              // Edge highlight (rim of cup reflection)
              float rim = smoothstep(0.4, 0.5, dist);

              // Mix colors
              vec3 col = mix(coffeeColor, creamColor, swirl * 0.15 + ripple);
              col += vec3(0.1) * rim; // Rim highlight

              // Surface reflection spot
              float highlight = smoothstep(0.15, 0.0, length(uv - vec2(-0.1, 0.1)));
              col += vec3(0.15) * highlight;

              gl_FragColor = vec4(col, 1.0);
            }
          `;
          const coffeeMat = new THREE.ShaderMaterial({
            uniforms: { time: { value: 0 } },
            vertexShader: coffeeVertShader,
            fragmentShader: coffeeFragShader
          });
          const coffee = new THREE.Mesh(coffeeGeom, coffeeMat);
          coffee.position.set(mugX, -1.54, mugZ);
          coffee.rotation.x = -Math.PI / 2;
          scene.add(coffee);

          // Steam particles with custom shader
          const steamParticles = [];
          const steamCount = 12;
          const steamVertShader = `
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `;
          const steamFragShader = `
            uniform float opacity;
            varying vec2 vUv;
            void main() {
              float dist = length(vUv - vec2(0.5));
              float alpha = smoothstep(0.5, 0.1, dist) * opacity;
              gl_FragColor = vec4(1.0, 1.0, 1.0, alpha * 0.4);
            }
          `;

          for (let i = 0; i < steamCount; i++) {
            const steamGeo = new THREE.PlaneGeometry(0.12, 0.2);
            const steamMat = new THREE.ShaderMaterial({
              uniforms: { opacity: { value: 0.6 } },
              vertexShader: steamVertShader,
              fragmentShader: steamFragShader,
              transparent: true,
              side: THREE.DoubleSide,
              depthWrite: false
            });
            const steam = new THREE.Mesh(steamGeo, steamMat);
            steam.position.set(
              mugX + (Math.random() - 0.5) * 0.15,
              -1.5 + Math.random() * 0.3,
              mugZ + (Math.random() - 0.5) * 0.15
            );
            steam.userData = {
              baseY: -1.5,
              speed: 0.0008 + Math.random() * 0.0006,  // Much slower
              drift: (Math.random() - 0.5) * 0.0003,
              phase: Math.random() * Math.PI * 2
            };
            scene.add(steam);
            steamParticles.push(steam);
          }

          // Steam animation function
          function updateSteam(time) {
            steamParticles.forEach(s => {
              s.position.y += s.userData.speed;
              s.position.x += Math.sin(time * 0.5 + s.userData.phase) * 0.0003 + s.userData.drift;
              s.position.z += Math.cos(time * 0.4 + s.userData.phase) * 0.0002;

              // Fade out as it rises
              const height = s.position.y - s.userData.baseY;
              s.material.uniforms.opacity.value = Math.max(0, 0.5 - height * 1.2);

              // Scale up as it rises
              const scale = 1 + height * 2;
              s.scale.set(scale, scale, 1);

              // Reset when faded
              if (height > 0.5) {
                s.position.y = s.userData.baseY;
                s.position.x = mugX + (Math.random() - 0.5) * 0.15;
                s.position.z = mugZ + (Math.random() - 0.5) * 0.15;
              }

              // Billboard - face camera
              s.lookAt(camera.position);
            });
          }

          // Link cable (coiled, front left)
          const cableMat = new THREE.MeshStandardMaterial({ color: 0x4a4a6a, roughness: 0.8 });
          for (let i = 0; i < 12; i++) {
            const cableGeom = new THREE.TorusGeometry(0.1 + i * 0.006, 0.015, 8, 16);
            const cable = new THREE.Mesh(cableGeom, cableMat);
            cable.position.set(-1.8, -1.97 + i * 0.005, 1.8);
            cable.rotation.x = Math.PI / 2;
            cable.rotation.z = i * 0.12;
            scene.add(cable);
          }
          // Cable connector
          const connectorGeom = new THREE.BoxGeometry(0.12, 0.06, 0.2);
          const connector = new THREE.Mesh(connectorGeom, cableMat);
          connector.position.set(-1.5, -1.97, 2.0);
          connector.rotation.y = 0.5;
          scene.add(connector);

          // AA Batteries (scattered near front)
          const battPositions = [[0.8, 2.2], [1.0, 2.0], [0.6, 2.4], [1.2, 2.3]];
          for (let i = 0; i < 4; i++) {
            const battGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.2, 8);
            const battMat = new THREE.MeshStandardMaterial({ color: 0xDAA520, metalness: 0.6 });
            const batt = new THREE.Mesh(battGeom, battMat);
            batt.position.set(battPositions[i][0], -1.98, battPositions[i][1]);
            batt.rotation.z = Math.PI / 2;
            batt.rotation.y = i * 0.4;
            scene.add(batt);
          }

          // Desk lamp (back right, adjusted)
          const lampBaseGeom = new THREE.CylinderGeometry(0.25, 0.3, 0.08, 16);
          const lampBaseMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.5 });
          const lampBase = new THREE.Mesh(lampBaseGeom, lampBaseMat);
          lampBase.position.set(2.8, -1.96, -2.2);
          scene.add(lampBase);
          const lampArmGeom = new THREE.CylinderGeometry(0.025, 0.025, 1.0, 8);
          const lampArm = new THREE.Mesh(lampArmGeom, lampBaseMat);
          lampArm.position.set(2.8, -1.4, -2.2);
          scene.add(lampArm);
          const lampShadeGeom = new THREE.ConeGeometry(0.3, 0.35, 16, 1, true);
          const lampShadeMat = new THREE.MeshStandardMaterial({ color: 0x3d5c3d, side: THREE.DoubleSide });
          const lampShade = new THREE.Mesh(lampShadeGeom, lampShadeMat);
          lampShade.position.set(2.8, -0.85, -2.2);
          lampShade.rotation.x = Math.PI;
          scene.add(lampShade);

          // Eraser (pink, near notebook)
          const eraserGeom = new THREE.BoxGeometry(0.2, 0.08, 0.4);
          const eraserMat = new THREE.MeshStandardMaterial({ color: 0xFFB6C1, roughness: 0.95 });
          const eraser = new THREE.Mesh(eraserGeom, eraserMat);
          eraser.position.set(-0.8, -1.96, -0.3);
          eraser.rotation.y = 0.4;
          scene.add(eraser);

          // Calculator (moved to back right)
          const calcGeom = new THREE.BoxGeometry(0.5, 0.05, 0.7);
          const calcMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
          const calc = new THREE.Mesh(calcGeom, calcMat);
          calc.position.set(2.5, -1.97, -1.6);
          calc.rotation.y = 0.3;
          scene.add(calc);
          // Calculator screen
          const calcScreenGeom = new THREE.PlaneGeometry(0.35, 0.15);
          const calcScreenMat = new THREE.MeshBasicMaterial({ color: 0x90EE90 });
          const calcScreen = new THREE.Mesh(calcScreenGeom, calcScreenMat);
          calcScreen.position.set(2.5, -1.94, -1.8);
          calcScreen.rotation.x = -Math.PI / 2;
          calcScreen.rotation.z = 0.3;
          scene.add(calcScreen);

          // === iPad with Shader Editor ===
          // iPad body (space gray)
          const ipadGeom = new THREE.BoxGeometry(1.1, 0.04, 1.5);
          const ipadMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3c, metalness: 0.8, roughness: 0.3 });
          const ipad = new THREE.Mesh(ipadGeom, ipadMat);
          ipad.position.set(1.6, -1.96, -1.2);
          ipad.rotation.y = -0.15;
          scene.add(ipad);

          // iPad screen with shader editor
          const ipadCanvas = document.createElement('canvas');
          ipadCanvas.width = 220;
          ipadCanvas.height = 300;
          const ipadCtx = ipadCanvas.getContext('2d');

          // Draw shader editor UI
          ipadCtx.fillStyle = '#1e1e2e';
          ipadCtx.fillRect(0, 0, 220, 300);

          // Title bar
          ipadCtx.fillStyle = '#2d2d3d';
          ipadCtx.fillRect(0, 0, 220, 24);
          ipadCtx.fillStyle = '#888';
          ipadCtx.font = '10px monospace';
          ipadCtx.fillText('shader.frag', 8, 16);

          // Traffic lights
          ipadCtx.fillStyle = '#ff5f56';
          ipadCtx.beginPath(); ipadCtx.arc(190, 12, 5, 0, Math.PI*2); ipadCtx.fill();
          ipadCtx.fillStyle = '#ffbd2e';
          ipadCtx.beginPath(); ipadCtx.arc(175, 12, 5, 0, Math.PI*2); ipadCtx.fill();
          ipadCtx.fillStyle = '#27ca40';
          ipadCtx.beginPath(); ipadCtx.arc(160, 12, 5, 0, Math.PI*2); ipadCtx.fill();

          // Code lines with syntax highlighting
          const codeLines = [
            { text: 'uniform float u_time;', color: '#c678dd' },
            { text: 'uniform vec2 u_resolution;', color: '#c678dd' },
            { text: '', color: '#666' },
            { text: 'void main() {', color: '#61afef' },
            { text: '  vec2 uv = gl_FragCoord.xy', color: '#abb2bf' },
            { text: '    / u_resolution;', color: '#abb2bf' },
            { text: '', color: '#666' },
            { text: '  // Color gradient', color: '#5c6370' },
            { text: '  vec3 col = vec3(uv.x,', color: '#98c379' },
            { text: '    uv.y, sin(u_time));', color: '#98c379' },
            { text: '', color: '#666' },
            { text: '  gl_FragColor =', color: '#e5c07b' },
            { text: '    vec4(col, 1.0);', color: '#e5c07b' },
            { text: '}', color: '#61afef' },
          ];

          codeLines.forEach((line, i) => {
            ipadCtx.fillStyle = '#4a4a5a';
            ipadCtx.fillText((i + 1).toString().padStart(2), 4, 42 + i * 16);
            ipadCtx.fillStyle = line.color;
            ipadCtx.fillText(line.text, 24, 42 + i * 16);
          });

          // Blinking cursor
          ipadCtx.fillStyle = '#528bff';
          ipadCtx.fillRect(140, 220, 8, 14);

          const ipadTexture = new THREE.CanvasTexture(ipadCanvas);
          const ipadScreenGeom = new THREE.PlaneGeometry(0.95, 1.3);
          const ipadScreenMat = new THREE.MeshBasicMaterial({ map: ipadTexture });
          const ipadScreen = new THREE.Mesh(ipadScreenGeom, ipadScreenMat);
          ipadScreen.position.set(1.6, -1.93, -1.2);
          ipadScreen.rotation.x = -Math.PI / 2;
          ipadScreen.rotation.z = -0.15;
          scene.add(ipadScreen);

          // Apple Pencil next to iPad
          const pencilBodyGeom = new THREE.CylinderGeometry(0.02, 0.018, 0.7, 8);
          const pencilBodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
          const applePencil = new THREE.Mesh(pencilBodyGeom, pencilBodyMat);
          applePencil.position.set(2.3, -1.98, -0.9);
          applePencil.rotation.z = Math.PI / 2;
          applePencil.rotation.y = -0.15;
          scene.add(applePencil);
          // Pencil tip
          const pencilTipGeom = new THREE.ConeGeometry(0.018, 0.06, 8);
          const pencilTipMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8 });
          const pencilTip = new THREE.Mesh(pencilTipGeom, pencilTipMat);
          pencilTip.position.set(2.65, -1.98, -0.85);
          pencilTip.rotation.z = -Math.PI / 2;
          scene.add(pencilTip);

          // === CRT TV (back center-left) ===
          // TV body
          const tvBodyGeom = new THREE.BoxGeometry(1.8, 1.4, 1.2);
          const tvBodyMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.7 });
          const tvBody = new THREE.Mesh(tvBodyGeom, tvBodyMat);
          tvBody.position.set(-1.5, -1.1, -3);
          scene.add(tvBody);
          // TV screen bezel
          const tvBezelGeom = new THREE.BoxGeometry(1.3, 1.0, 0.05);
          const tvBezelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
          const tvBezel = new THREE.Mesh(tvBezelGeom, tvBezelMat);
          tvBezel.position.set(-1.5, -1.05, -2.35);
          scene.add(tvBezel);
          // CRT screen with animated static
          const crtCanvas = document.createElement('canvas');
          crtCanvas.width = 128;
          crtCanvas.height = 96;
          const crtCtx = crtCanvas.getContext('2d', { willReadFrequently: true });
          const crtTexture = new THREE.CanvasTexture(crtCanvas);
          const tvScreenGeom = new THREE.PlaneGeometry(1.15, 0.85);
          const tvScreenMat = new THREE.MeshBasicMaterial({ map: crtTexture });
          const tvScreen = new THREE.Mesh(tvScreenGeom, tvScreenMat);
          tvScreen.position.set(-1.5, -1.05, -2.33);
          scene.add(tvScreen);
          // TV control knobs
          for (let i = 0; i < 2; i++) {
            const knobGeom = new THREE.CylinderGeometry(0.06, 0.06, 0.08, 12);
            const knobMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.5 });
            const knob = new THREE.Mesh(knobGeom, knobMat);
            knob.position.set(-0.5, -1.4 + i * 0.3, -2.38);
            knob.rotation.x = Math.PI / 2;
            scene.add(knob);
          }
          // VHF/UHF labels
          const tvLabelGeom = new THREE.PlaneGeometry(0.15, 0.05);
          const tvLabelMat = new THREE.MeshBasicMaterial({ color: 0xcccccc });
          const tvLabel = new THREE.Mesh(tvLabelGeom, tvLabelMat);
          tvLabel.position.set(-0.5, -1.6, -2.39);
          scene.add(tvLabel);

          // CRT shader - "BAGUETTE" with static interference
          let crtTime = 0;
          function updateCRTStatic() {
            crtTime++;

            // Brighter blue CRT background
            crtCtx.fillStyle = '#1a2a4a';
            crtCtx.fillRect(0, 0, 128, 96);

            // CRT glow effect
            const gradient = crtCtx.createRadialGradient(64, 48, 0, 64, 48, 60);
            gradient.addColorStop(0, 'rgba(60,80,120,0.4)');
            gradient.addColorStop(1, 'rgba(20,30,50,0)');
            crtCtx.fillStyle = gradient;
            crtCtx.fillRect(0, 0, 128, 96);

            // Draw "BAGUETTE" text with CRT glow
            const textY = 42 + Math.sin(crtTime * 0.05) * 1.5;
            const hOffset = Math.sin(crtTime * 0.1) * 1;

            // Text glow
            crtCtx.font = 'bold 16px monospace';
            crtCtx.textAlign = 'center';

            // Glow layers
            crtCtx.fillStyle = 'rgba(100,150,255,0.3)';
            crtCtx.fillText('BAGUETTE', 64, textY + 1);

            // Chromatic aberration
            crtCtx.fillStyle = 'rgba(255,100,100,0.5)';
            crtCtx.fillText('BAGUETTE', 64 + hOffset - 1.5, textY);
            crtCtx.fillStyle = 'rgba(100,100,255,0.5)';
            crtCtx.fillText('BAGUETTE', 64 + hOffset + 1.5, textY);

            // Main bright text
            crtCtx.fillStyle = '#ffffff';
            crtCtx.fillText('BAGUETTE', 64 + hOffset, textY);

            // Subtitle
            crtCtx.font = '9px monospace';
            crtCtx.fillStyle = '#88aacc';
            crtCtx.fillText('.art', 64 + hOffset, textY + 16);

            // Static noise overlay
            const imageData = crtCtx.getImageData(0, 0, 128, 96);
            for (let i = 0; i < imageData.data.length; i += 4) {
              const noise = (Math.random() - 0.5) * 40;
              imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + noise));
              imageData.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + noise));
              imageData.data[i + 2] = Math.max(0, Math.min(255, imageData.data[i + 2] + noise));
            }

            // Scanlines
            for (let y = 0; y < 96; y += 2) {
              for (let x = 0; x < 128; x++) {
                const idx = (y * 128 + x) * 4;
                imageData.data[idx] *= 0.6;
                imageData.data[idx + 1] *= 0.6;
                imageData.data[idx + 2] *= 0.6;
              }
            }

            // Random horizontal glitch lines
            if (Math.random() < 0.1) {
              const glitchY = Math.floor(Math.random() * 96);
              const glitchShift = Math.floor(Math.random() * 20) - 10;
              for (let x = 0; x < 128; x++) {
                const srcIdx = (glitchY * 128 + Math.max(0, Math.min(127, x + glitchShift))) * 4;
                const dstIdx = (glitchY * 128 + x) * 4;
                imageData.data[dstIdx] = imageData.data[srcIdx] + 30;
                imageData.data[dstIdx + 1] = imageData.data[srcIdx + 1] + 30;
                imageData.data[dstIdx + 2] = imageData.data[srcIdx + 2] + 30;
              }
            }

            crtCtx.putImageData(imageData, 0, 0);
            crtTexture.needsUpdate = true;
          }

          // Gameboy plane from captured texture
          const texture = new THREE.CanvasTexture(canvas);
          texture.minFilter = THREE.LinearFilter;
          const aspect = canvas.width / canvas.height;
          const gbGeom = new THREE.PlaneGeometry(3 * aspect, 3);
          const gbMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
          const gameboy = new THREE.Mesh(gbGeom, gbMat);
          scene.add(gameboy);

          // Soft ambient light
          const ambient = new THREE.AmbientLight(0xfff8e0, 0.6);
          scene.add(ambient);

          // Warm point light (desk lamp feel)
          const lamp = new THREE.PointLight(0xffaa44, 1.2, 20);
          lamp.position.set(3, 5, 3);
          scene.add(lamp);

          // Camera state for zoom
          let camDistance = 6;
          let camHeight = 0;
          let targetDistance = 4;
          let targetHeight = 4;
          let animationDone = false;

          camera.position.set(0, 0, camDistance);
          camera.lookAt(0, 0, 0);

          // Animation: lay gameboy down on desk
          const duration = 2500;
          const startTime = Date.now();

          let crtFrame = 0;
          function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);

            // Rotate gameboy to lay flat
            gameboy.rotation.x = -Math.PI / 2 * eased;
            gameboy.position.y = -2 + 0.05 + (1 - eased) * 2;
            gameboy.position.z = eased * 0.5;

            // Smoothly interpolate camera
            camHeight += (targetHeight * eased - camHeight) * 0.1;
            camDistance += (targetDistance - camDistance) * 0.05;

            camera.position.y = camHeight;
            camera.position.z = camDistance;
            camera.lookAt(0, -1.5, 0);

            // Update CRT static (every 3 frames for that choppy retro feel)
            crtFrame++;
            if (crtFrame % 3 === 0) updateCRTStatic();

            // Animate steam
            updateSteam(elapsed * 0.001);

            // Animate coffee ripples
            coffeeMat.uniforms.time.value = elapsed * 0.001;

            renderer.render(scene, camera);

            if (progress >= 1) animationDone = true;
            requestAnimationFrame(animate);
          }
          animate();

          // Add overlay with text
          const overlay = document.createElement('div');
          overlay.className = 'ending-overlay';
          const isDesktop = !('ontouchstart' in window);
          overlay.innerHTML = `
            <div class="ending-text">Thanks for playing!</div>
            <div class="ending-links">
              <a href="mailto:hello@baguette.art">hello@baguette.art</a>
              <a href="https://x.com/baguetteanon" target="_blank">@baguetteanon</a>
            </div>
            <div class="play-again-btn" id="play-again">PLAY AGAIN</div>
            ${isDesktop ? '<div class="zoom-hint">scroll to zoom</div>' : ''}
          `;
          document.body.appendChild(overlay);

          // Restart handlers
          const restart = () => location.reload();
          document.getElementById('play-again').addEventListener('click', restart);
          document.getElementById('play-again').addEventListener('touchend', (e) => {
            e.preventDefault();
            restart();
          });

          // Start button also restarts
          document.querySelector('.btn-start').addEventListener('click', restart);

          // Scroll wheel zoom (desktop only)
          if (isDesktop) {
            container.addEventListener('wheel', (e) => {
              e.preventDefault();
              targetDistance = Math.max(2, Math.min(10, targetDistance + e.deltaY * 0.005));
            }, { passive: false });
          }

          // Handle window resize
          window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
          });
          } catch(e) { console.error('3D scene error:', e); }
        }).catch(e => console.error('html2canvas error:', e));
      }, 300);
    }

    function enemyAttack() {
      isAnimating = true;
      const enemy = enemies[currentEnemy];
      showMessage(`Wild ${enemy.name}<br>used ${enemy.attack}!`);

      const playerRect = playerCreature.getBoundingClientRect();
      const enemyRect = enemyCreature.getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();

      const fromX = enemyRect.left - viewportRect.left + enemyRect.width / 2;
      const fromY = enemyRect.top - viewportRect.top + enemyRect.height / 2;
      const toX = playerRect.left - viewportRect.left + playerRect.width / 2;
      const toY = playerRect.top - viewportRect.top + playerRect.height / 2;

      // Determine projectile and particle types based on enemy
      let projType = 'void', particleType = 'void';
      if (enemy.sprite === 'slime') { projType = 'sludge'; particleType = 'sludge'; }
      else if (enemy.sprite === 'crystowl') { projType = 'ice'; particleType = 'ice'; }
      else if (enemy.sprite === 'moldspore') { projType = 'spore'; particleType = 'spore'; }
      else if (enemy.type === 'FIRE') { projType = 'ember'; particleType = 'ember'; }

      // Enemy charge particles
      setTimeout(() => {
        spawnParticleBurst(particleType, fromX, fromY, 6, 25);
      }, 200);

      setTimeout(() => {

        createProjectile(fromX, fromY, toX, toY, projType, () => {
          hitCreature(playerCreature);
          screenShake();
          triggerImpactFlash();
          vibrateOnDamage();

          // Trigger enemy-specific attack shader
          if (enemy.shader) {
            viewport.classList.add(enemy.shader + '-attack');
            setTimeout(() => viewport.classList.remove(enemy.shader + '-attack'), enemy.shader === 'ice' ? 400 : 500);
          }

          const damage = enemy.damage[0] + Math.floor(Math.random() * (enemy.damage[1] - enemy.damage[0]));
          playerHp = Math.max(0, playerHp - damage);
          updateHpBar(playerHpBar, playerHp, true);
          showDamage(toX, toY - 30, damage);
          spawnParticleBurst(particleType, toX, toY, 10, 40);

          // Screen splat for sludge attacks
          if (particleType === 'sludge') {
            createScreenSplat();
          }

          // Apply status effects (30% chance)
          const oldStatus = playerStatus;
          if (enemy.type === 'POISON' || enemy.sprite === 'slime') {
            applyStatusEffect('poison');
          } else if (enemy.type === 'FIRE') {
            applyStatusEffect('burn');
          }

          // Show status inflicted message
          const statusApplied = !oldStatus && playerStatus;

          const finishTurn = () => {
            if (playerHp <= 15 && playerHp > 0) {
              isAnimating = false;
              setTimeout(() => useAutoHeal(), 800);
            } else if (playerHp <= 0) {
              showMessage('SWEETBUN<br>fainted!');
              isAnimating = false;
              clearPlayerStatus();
              setTimeout(() => {
                playerHp = 100;
                updateHpBar(playerHpBar, 100, true);
                showMessage('SWEETBUN woke up!');
                setTimeout(() => showMessage('What will<br>SWEETBUN do?'), 1500);
              }, 2000);
            } else {
              // Process status damage before player's turn
              processStatusDamage(() => {
                isAnimating = false;
                showMessage('What will<br>SWEETBUN do?');
              });
            }
          };

          if (statusApplied) {
            setTimeout(() => {
              const statusMsg = playerStatus === 'burn' ? 'SWEETBUN was<br>burned!' : 'SWEETBUN was<br>poisoned!';
              showMessage(statusMsg);
              setTimeout(finishTurn, 1200);
            }, 600);
          } else {
            setTimeout(finishTurn, 400);
          }
        });
      }, 500);
    }

    function useAutoHeal() {
      isAnimating = true;

      const playerRect = playerCreature.getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();
      const cx = playerRect.left - viewportRect.left + playerRect.width / 2;
      const cy = playerRect.top - viewportRect.top + playerRect.height / 2;

      // If poisoned, use antidote first
      if (playerStatus === 'poison' && items['antidote'].count > 0) {
        items['antidote'].count--;
        const btn = document.querySelector('[data-item="antidote"]');
        if (btn) btn.querySelector('.item-count').textContent = `x${items['antidote'].count}`;

        showMessage('SWEETBUN used<br>ANTIDOTE!');
        setTimeout(() => {
          clearPlayerStatus();
          spawnHealParticles('antidote', playerCreature, 12);
          showMessage('SWEETBUN was<br>cured of poison!');
          isAnimating = false;
          setTimeout(() => showMessage('What will<br>SWEETBUN do?'), 1500);
        }, 800);
        return;
      }

      // If burned, use burn heal first
      if (playerStatus === 'burn' && items['burn-heal'].count > 0) {
        items['burn-heal'].count--;
        const btn = document.querySelector('[data-item="burn-heal"]');
        if (btn) btn.querySelector('.item-count').textContent = `x${items['burn-heal'].count}`;

        showMessage('SWEETBUN used<br>BURN HEAL!');
        setTimeout(() => {
          clearPlayerStatus();
          spawnHealParticles('burn-cure', playerCreature, 12);
          showMessage('SWEETBUN\'s burn<br>was healed!');
          isAnimating = false;
          setTimeout(() => showMessage('What will<br>SWEETBUN do?'), 1500);
        }, 800);
        return;
      }

      // Otherwise use potion for HP
      if (items['potion'].count > 0) {
        items['potion'].count--;
        const btn = document.querySelector('[data-item="potion"]');
        if (btn) btn.querySelector('.item-count').textContent = `x${items['potion'].count}`;

        showMessage('SWEETBUN used<br>POTION!');
        setTimeout(() => {
          showMessage("SWEETBUN's HP<br>was restored!");
          setTimeout(() => {
            const healAmount = Math.min(20, 100 - playerHp);
            playerHp = Math.min(100, playerHp + 20);
            updateHpBar(playerHpBar, playerHp, true);
            spawnHealParticles('heal', playerCreature, 10);
            showDamage(cx, cy - 30, healAmount, false, true);
            isAnimating = false;
            setTimeout(() => showMessage('What will<br>SWEETBUN do?'), 1500);
          }, 400);
        }, 800);
      } else {
        isAnimating = false;
        showMessage('What will<br>SWEETBUN do?');
      }
    }

    function useItem(itemName) {
      if (isAnimating) return;
      const item = items[itemName];
      if (!item || item.count <= 0) return;

      isAnimating = true;
      item.count--;
      const btn = document.querySelector(`[data-item="${itemName}"]`);
      if (btn) btn.querySelector('.item-count').textContent = `x${item.count}`;

      const displayName = itemName.toUpperCase().replace('-', ' ');
      showMessage(`SWEETBUN used<br>${displayName}!`);
      showMenu('main');

      const playerRect = playerCreature.getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();
      const cx = playerRect.left - viewportRect.left + playerRect.width / 2;
      const cy = playerRect.top - viewportRect.top + playerRect.height / 2;

      // Status cure items
      if (item.cures) {
        setTimeout(() => {
          if (playerStatus === item.cures) {
            clearPlayerStatus();
            spawnHealParticles(item.particles, playerCreature, 12);
            const cureMsg = item.cures === 'poison' ? 'SWEETBUN was<br>cured of poison!' : 'SWEETBUN\'s burn<br>was healed!';
            showMessage(cureMsg);
          } else {
            showMessage('It won\'t have<br>any effect...');
          }
          setTimeout(() => {
            isAnimating = false;
            enemyAttack();
          }, 1200);
        }, 800);
        return;
      }

      // HP healing items - show message first, then heal (like real Pokemon)
      setTimeout(() => {
        const healAmount = Math.min(item.heal, 100 - playerHp);
        showMessage(`SWEETBUN's HP<br>was restored!`);

        // Delay the actual HP bar fill after the message
        setTimeout(() => {
          playerHp = Math.min(100, playerHp + item.heal);
          updateHpBar(playerHpBar, playerHp, true);
          spawnHealParticles('heal', playerCreature, 10);
          showDamage(cx, cy - 30, healAmount, false, true);

          setTimeout(() => {
            isAnimating = false;
            enemyAttack();
          }, 800);
        }, 400);
      }, 800);
    }

    // Helper: move cursor to tapped button (single cursor)
    function selectButton(btn, menuType) {
      const items = document.querySelectorAll(
        menuType === 'main' ? '.action-btn' :
        menuType === 'fight' ? '.move-btn' : '.item-btn'
      );
      const index = Array.from(items).indexOf(btn);
      if (index !== -1) {
        cursorPos[menuType] = index;
        updateCursor();
      }
    }

    // Event listeners
    document.querySelectorAll('.action-btn').forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        if (isAnimating) return;
        cursorPos.main = idx;
        updateCursor();
        const action = btn.dataset.action;
        if (action === 'fight') showMenu('fight');
        else if (action === 'bag') showMenu('items');
        else if (action === 'run') {
          showMessage("Can't escape!");
          setTimeout(() => showMessage('What will<br>SWEETBUN do?'), 1500);
        }
        else if (action === 'pokemon') {
          showMessage('SWEETBUN is<br>already out!');
          setTimeout(() => showMessage('What will<br>SWEETBUN do?'), 1500);
        }
      });
    });

    document.querySelectorAll('.move-btn').forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        cursorPos.fight = idx;
        updateCursor();
        useMove(btn.dataset.move);
      });
      btn.addEventListener('mouseenter', () => {
        const move = moves[btn.dataset.move];
        if (move) {
          document.getElementById('move-type').textContent = `TYPE/${move.type}`;
          document.getElementById('move-pp').textContent = `PP ${move.pp}/${move.maxPp}`;
        }
      });
    });

    document.querySelectorAll('.item-btn').forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        cursorPos.items = idx;
        updateCursor();
        if (btn.dataset.item === 'cancel') showMenu('main');
        else useItem(btn.dataset.item);
      });
    });

    // Tap creatures
    playerCreature.addEventListener('click', () => {
      if (currentMenu === 'main' && !isAnimating) showMenu('fight');
    });

    enemyCreature.addEventListener('click', () => {
      if (currentMenu === 'main' && !isAnimating) {
        showMessage('Wild SPECTER<br>looks angry!');
        spawnParticleBurst('void',
          enemyCreature.getBoundingClientRect().left - viewport.getBoundingClientRect().left + 40,
          enemyCreature.getBoundingClientRect().top - viewport.getBoundingClientRect().top + 40,
          6, 30);
        setTimeout(() => showMessage('What will<br>SWEETBUN do?'), 1500);
      }
    });

    // ========== D-PAD AND BUTTON NAVIGATION ==========
    let cursorPos = { main: 0, fight: 0, items: 0 };

    function getMenuItems() {
      if (currentMenu === 'main') {
        return document.querySelectorAll('.action-btn');
      } else if (currentMenu === 'fight') {
        return document.querySelectorAll('.move-btn');
      } else if (currentMenu === 'items') {
        return document.querySelectorAll('.item-btn');
      }
      return [];
    }

    function updateCursor() {
      // Clear all selections
      document.querySelectorAll('.action-btn, .move-btn, .item-btn').forEach(btn => {
        btn.classList.remove('selected');
      });

      // Set current selection
      const items = getMenuItems();
      const pos = cursorPos[currentMenu] || 0;
      if (items[pos]) {
        items[pos].classList.add('selected');
        // Update move info if in fight menu
        if (currentMenu === 'fight' && items[pos].dataset.move) {
          const move = moves[items[pos].dataset.move];
          if (move) {
            document.getElementById('move-type').textContent = `TYPE/${move.type}`;
            document.getElementById('move-pp').textContent = `PP ${move.pp}/${move.maxPp}`;
          }
        }
      }
    }

    function moveCursor(direction) {
      if (isAnimating) return;
      const items = getMenuItems();
      if (items.length === 0) return;

      let pos = cursorPos[currentMenu] || 0;
      const cols = 2; // 2-column grid layout

      if (direction === 'up') {
        pos = pos >= cols ? pos - cols : pos;
      } else if (direction === 'down') {
        pos = pos + cols < items.length ? pos + cols : pos;
      } else if (direction === 'left') {
        pos = pos % cols > 0 ? pos - 1 : pos;
      } else if (direction === 'right') {
        pos = pos % cols < cols - 1 && pos + 1 < items.length ? pos + 1 : pos;
      }

      cursorPos[currentMenu] = pos;
      updateCursor();
    }

    function pressA() {
      if (isAnimating) return;
      const items = getMenuItems();
      const pos = cursorPos[currentMenu] || 0;
      if (items[pos]) {
        items[pos].click();
      }
    }

    function pressB() {
      if (isAnimating) return;
      if (currentMenu === 'fight' || currentMenu === 'items') {
        showMenu('main');
      }
    }

    // D-pad event listeners
    document.getElementById('dpad-up').addEventListener('click', () => moveCursor('up'));
    document.getElementById('dpad-down').addEventListener('click', () => moveCursor('down'));
    document.getElementById('dpad-left').addEventListener('click', () => moveCursor('left'));
    document.getElementById('dpad-right').addEventListener('click', () => moveCursor('right'));

    // A/B button listeners
    document.getElementById('btn-a').addEventListener('click', pressA);
    document.getElementById('btn-b').addEventListener('click', pressB);

    // Keyboard support too
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') moveCursor('up');
      else if (e.key === 'ArrowDown') moveCursor('down');
      else if (e.key === 'ArrowLeft') moveCursor('left');
      else if (e.key === 'ArrowRight') moveCursor('right');
      else if (e.key === 'z' || e.key === 'Z' || e.key === 'Enter') pressA();
      else if (e.key === 'x' || e.key === 'X' || e.key === 'Backspace') pressB();
    });

    // Update cursor when menu changes
    const origShowMenu = showMenu;
    showMenu = function(menu) {
      origShowMenu(menu);
      setTimeout(updateCursor, 10);
    };

    // Initialize cursor on page load
    setTimeout(updateCursor, 100);
