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

    // Power OFF switch - triggers ending sequence with black screen
    const powerOffSwitch = document.getElementById('power-off-switch');
    if (powerOffSwitch) {
      powerOffSwitch.addEventListener('click', () => {
        // Add screen power-off effect
        viewport.classList.add('powering-off');

        // After screen blacks out, trigger ending
        setTimeout(() => {
          showEndingScreen(true); // true = powered off (black screen)
        }, 800);
      });
    }

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
      { name: 'SPECTER', level: 50, hp: 100, maxHp: 100, exp: 150, sprite: 'void', type: 'GHOST', attack: 'SHADOW SNEAK', damage: [10, 18], shader: 'spectre' },
      { name: 'MOLDSPORE', level: 52, hp: 110, maxHp: 110, exp: 170, sprite: 'moldspore', type: 'POISON', attack: 'TOXIC SPORE', damage: [10, 16], shader: 'toxic' },
      { name: 'CRYSTOWL', level: 54, hp: 130, maxHp: 130, exp: 200, sprite: 'crystowl', type: 'ICE', attack: 'FROST WING', damage: [14, 22], shader: 'ice' },
      { name: 'SLIME', level: 56, hp: 140, maxHp: 140, exp: 220, sprite: 'slime', type: 'POISON', attack: 'SLUDGE BOMB', damage: [14, 22], shader: 'slime' },
      { name: 'INFERNO', level: 58, hp: 160, maxHp: 160, exp: 280, sprite: 'inferno', type: 'FIRE', attack: 'FLAME BURST', damage: [16, 26], shader: 'fire' }
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

    function showEndingScreen(poweredOff = false) {
      // If powered off, show black screen
      if (poweredOff) {
        // Hide all viewport content - make screen black
        viewport.style.background = '#000';
        viewport.innerHTML = '<div style="width:100%;height:100%;background:#111;"></div>';
      } else {
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
      }

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

          // === MANHATTAN APARTMENT - 50TH FLOOR ===

          // Large window behind desk with city view
          const windowWidth = 10, windowHeight = 6;
          const windowGeom = new THREE.PlaneGeometry(windowWidth, windowHeight);

          // Create city skyline canvas texture
          const cityCanvas = document.createElement('canvas');
          cityCanvas.width = 512;
          cityCanvas.height = 320;
          const cityCtx = cityCanvas.getContext('2d');

          // Night sky gradient
          const skyGrad = cityCtx.createLinearGradient(0, 0, 0, 320);
          skyGrad.addColorStop(0, '#0a0a1a');
          skyGrad.addColorStop(0.4, '#1a1a2a');
          skyGrad.addColorStop(1, '#2a2a3a');
          cityCtx.fillStyle = skyGrad;
          cityCtx.fillRect(0, 0, 512, 320);

          // Snowflakes
          cityCtx.fillStyle = 'rgba(255,255,255,0.6)';
          for (let i = 0; i < 80; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 320;
            const r = Math.random() * 2 + 0.5;
            cityCtx.beginPath();
            cityCtx.arc(x, y, r, 0, Math.PI * 2);
            cityCtx.fill();
          }

          // Draw buildings (Manhattan skyline from 50th floor)
          const buildings = [];
          for (let i = 0; i < 35; i++) {
            buildings.push({
              x: i * 15 + Math.random() * 8,
              w: 8 + Math.random() * 12,
              h: 80 + Math.random() * 200,
              lit: Math.random() > 0.3
            });
          }
          buildings.sort((a, b) => b.h - a.h); // Draw tallest first (farther)

          buildings.forEach(b => {
            // Building silhouette
            cityCtx.fillStyle = `rgb(${15 + Math.random() * 20}, ${15 + Math.random() * 15}, ${25 + Math.random() * 20})`;
            cityCtx.fillRect(b.x, 320 - b.h, b.w, b.h);

            // Windows (lit randomly)
            if (b.lit) {
              for (let wy = 320 - b.h + 5; wy < 315; wy += 8) {
                for (let wx = b.x + 2; wx < b.x + b.w - 2; wx += 4) {
                  if (Math.random() > 0.4) {
                    const warm = Math.random() > 0.3;
                    cityCtx.fillStyle = warm ? 'rgba(255,220,150,0.8)' : 'rgba(200,220,255,0.6)';
                    cityCtx.fillRect(wx, wy, 2, 4);
                  }
                }
              }
            }
          });

          // Empire State Building silhouette (center-right)
          cityCtx.fillStyle = '#1a1a2a';
          cityCtx.fillRect(340, 40, 25, 280);
          cityCtx.fillRect(345, 20, 15, 20);
          cityCtx.fillRect(350, 5, 5, 15);
          // Antenna light
          cityCtx.fillStyle = '#ff3333';
          cityCtx.beginPath();
          cityCtx.arc(352, 5, 2, 0, Math.PI * 2);
          cityCtx.fill();

          const cityTexture = new THREE.CanvasTexture(cityCanvas);
          const windowMat = new THREE.MeshBasicMaterial({ map: cityTexture });
          const windowMesh = new THREE.Mesh(windowGeom, windowMat);
          windowMesh.position.set(0, 1.5, -4.5);  // Closer and higher
          scene.add(windowMesh);

          // Window frame
          const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.6, roughness: 0.4 });
          const frameThick = 0.1;
          const windowZ = -4.45;
          const windowY = 1.5;
          // Top frame
          const frameTop = new THREE.Mesh(new THREE.BoxGeometry(windowWidth + 0.3, frameThick, 0.15), frameMat);
          frameTop.position.set(0, windowY + windowHeight/2, windowZ);
          scene.add(frameTop);
          // Bottom frame (window sill)
          const frameBotGeom = new THREE.BoxGeometry(windowWidth + 0.4, 0.15, 0.3);
          const frameBot = new THREE.Mesh(frameBotGeom, frameMat);
          frameBot.position.set(0, windowY - windowHeight/2, windowZ + 0.1);
          scene.add(frameBot);
          // Side frames
          const frameL = new THREE.Mesh(new THREE.BoxGeometry(frameThick, windowHeight + 0.2, 0.15), frameMat);
          frameL.position.set(-windowWidth/2, windowY, windowZ);
          scene.add(frameL);
          const frameR = new THREE.Mesh(new THREE.BoxGeometry(frameThick, windowHeight + 0.2, 0.15), frameMat);
          frameR.position.set(windowWidth/2, windowY, windowZ);
          scene.add(frameR);
          // Center dividers (cross pattern)
          const frameVert = new THREE.Mesh(new THREE.BoxGeometry(0.05, windowHeight, 0.08), frameMat);
          frameVert.position.set(0, windowY, windowZ);
          scene.add(frameVert);
          const frameHorz = new THREE.Mesh(new THREE.BoxGeometry(windowWidth, 0.05, 0.08), frameMat);
          frameHorz.position.set(0, windowY, windowZ);
          scene.add(frameHorz);

          // === INTERACTIVE OBJECTS SYSTEM ===
          // All interactive objects with unique shader reactions that lerp back
          const interactiveObjects = [];
          const shaderReactions = {};

          // Lerp helper
          function lerp(a, b, t) { return a + (b - a) * t; }

          // Shared GLSL noise functions for shaders
          const glslNoise = `
            float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
            float noise(vec2 p) {
              vec2 i = floor(p), f = fract(p);
              float a = hash(i), b = hash(i + vec2(1.0, 0.0));
              float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
              vec2 u = f * f * (3.0 - 2.0 * f);
              return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
            }
            float fbm(vec2 p) {
              float v = 0.0, a = 0.5;
              for (int i = 0; i < 4; i++) { v += noise(p) * a; p *= 2.0; a *= 0.5; }
              return v;
            }
          `;

          // === DESK DETAILS (ENHANCED) ===

          // Stack of textbooks with spine details and page edges
          const books = [
            { color: 0x8B0000, w: 1.3, h: 0.18, d: 1.0, title: 'GLSL', pages: 0xf5f0e0 },
            { color: 0x00008B, w: 1.2, h: 0.12, d: 0.9, title: 'THREE', pages: 0xfff8e7 },
            { color: 0x2F4F2F, w: 1.25, h: 0.15, d: 0.95, title: 'HLSL', pages: 0xf0e8d8 },
            { color: 0x4B0082, w: 1.15, h: 0.10, d: 0.85, title: 'GPU', pages: 0xfff5e0 },
            { color: 0x8B4513, w: 1.1, h: 0.14, d: 0.88, title: 'MATH', pages: 0xf8f0e0 },
          ];

          // Create book spine texture
          function createBookSpine(title, baseColor, height) {
            const spineCanvas = document.createElement('canvas');
            spineCanvas.width = 64;
            spineCanvas.height = 256;
            const ctx = spineCanvas.getContext('2d');

            // Base color
            const r = (baseColor >> 16) & 255;
            const g = (baseColor >> 8) & 255;
            const b = baseColor & 255;
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(0, 0, 64, 256);

            // Wear/texture
            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            for (let i = 0; i < 20; i++) {
              ctx.fillRect(Math.random() * 64, Math.random() * 256, Math.random() * 10, 1);
            }

            // Gold foil title
            ctx.save();
            ctx.translate(32, 128);
            ctx.rotate(-Math.PI / 2);
            ctx.font = 'bold 18px serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#d4af37';
            ctx.fillText(title, 0, 6);
            ctx.restore();

            // Decorative lines
            ctx.strokeStyle = '#d4af37';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(8, 20); ctx.lineTo(56, 20);
            ctx.moveTo(8, 236); ctx.lineTo(56, 236);
            ctx.stroke();

            return new THREE.CanvasTexture(spineCanvas);
          }

          // Store book meshes for interactivity
          const bookMeshes = [];
          let bookY = -1.98;
          let booksGlowing = false;
          let runeLight = null;

          // Create page edge texture for books
          function createPageEdgeTexture() {
            const c = document.createElement('canvas');
            c.width = 128; c.height = 32;
            const ctx = c.getContext('2d');
            ctx.fillStyle = '#f5f0e0';
            ctx.fillRect(0, 0, 128, 32);
            // Individual page lines
            ctx.strokeStyle = '#d0c8b0';
            ctx.lineWidth = 0.5;
            for (let i = 0; i < 64; i++) {
              const x = i * 2;
              ctx.beginPath();
              ctx.moveTo(x, 0);
              ctx.lineTo(x, 32);
              ctx.stroke();
            }
            return new THREE.CanvasTexture(c);
          }
          const pageEdgeTexture = createPageEdgeTexture();

          books.forEach((b, i) => {
            // Main book body
            const bookGeom = new THREE.BoxGeometry(b.w, b.h, b.d, 2, 1, 2);
            const spineTexture = createBookSpine(b.title, b.color, b.h);

            // Page edge material with texture
            const pageEdgeMat = new THREE.MeshStandardMaterial({
              map: pageEdgeTexture,
              color: b.pages,
              roughness: 0.95
            });

            const bookMaterials = [
              new THREE.MeshStandardMaterial({ map: spineTexture }), // right (spine)
              pageEdgeMat, // left (page edges)
              new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.85 }), // top
              new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.85 }), // bottom
              pageEdgeMat, // front (page edges)
              new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.85 }), // back
            ];
            const book = new THREE.Mesh(bookGeom, bookMaterials);
            bookY += b.h / 2;
            book.position.set(-2.5, bookY, -1.2);
            book.rotation.y = (i % 2 === 0 ? 0.08 : -0.05);
            book.userData = {
              baseY: bookY,
              color: b.color,
              title: b.title,
              type: 'book',
              reactionIntensity: 0,
              originalY: bookY
            };
            bookY += b.h / 2 + 0.005;
            scene.add(book);
            bookMeshes.push(book);
            interactiveObjects.push(book);
          });

          // Book reaction shader (pulse glow effect)
          shaderReactions.books = { intensity: 0, target: 0 };

          // Rune overlay for books (hidden initially)
          const runeCanvas = document.createElement('canvas');
          runeCanvas.width = 128;
          runeCanvas.height = 128;
          const runeCtx = runeCanvas.getContext('2d');

          function drawRunes(time) {
            runeCtx.clearRect(0, 0, 128, 128);
            runeCtx.fillStyle = `rgba(100, 200, 255, ${0.3 + Math.sin(time * 3) * 0.2})`;

            // Draw mystical rune symbols
            const runes = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ', 'ᚺ', 'ᚾ'];
            runeCtx.font = '20px serif';
            runeCtx.textAlign = 'center';

            for (let i = 0; i < 6; i++) {
              const x = 20 + (i % 3) * 44;
              const y = 40 + Math.floor(i / 3) * 50;
              const glow = Math.sin(time * 2 + i) * 0.5 + 0.5;
              runeCtx.fillStyle = `rgba(100, 200, 255, ${0.4 + glow * 0.6})`;
              runeCtx.fillText(runes[i], x, y);
            }

            // Glowing circle
            runeCtx.strokeStyle = `rgba(150, 220, 255, ${0.3 + Math.sin(time * 4) * 0.2})`;
            runeCtx.lineWidth = 2;
            runeCtx.beginPath();
            runeCtx.arc(64, 64, 50 + Math.sin(time * 2) * 5, 0, Math.PI * 2);
            runeCtx.stroke();
          }

          const runeTexture = new THREE.CanvasTexture(runeCanvas);
          const runePlaneGeom = new THREE.PlaneGeometry(1.5, 1.2);
          const runePlaneMat = new THREE.MeshBasicMaterial({
            map: runeTexture,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
          });
          const runePlane = new THREE.Mesh(runePlaneGeom, runePlaneMat);
          runePlane.position.set(-2.5, -1.3, -1.2);
          runePlane.rotation.x = -Math.PI / 2;
          scene.add(runePlane);

          // === ENHANCED NOTEBOOK with ruled lines and shimmer shader ===
          const notebookCanvas = document.createElement('canvas');
          notebookCanvas.width = 256; notebookCanvas.height = 256;
          const nbCtx = notebookCanvas.getContext('2d');
          nbCtx.fillStyle = '#f8f5e8';
          nbCtx.fillRect(0, 0, 256, 256);
          // Ruled lines
          nbCtx.strokeStyle = '#a8c8e8';
          nbCtx.lineWidth = 1;
          for (let y = 20; y < 256; y += 16) {
            nbCtx.beginPath();
            nbCtx.moveTo(30, y);
            nbCtx.lineTo(256, y);
            nbCtx.stroke();
          }
          // Red margin
          nbCtx.strokeStyle = '#e88888';
          nbCtx.lineWidth = 2;
          nbCtx.beginPath();
          nbCtx.moveTo(30, 0);
          nbCtx.lineTo(30, 256);
          nbCtx.stroke();
          // Some "handwriting"
          nbCtx.fillStyle = '#2a4a6a';
          nbCtx.font = '12px cursive';
          nbCtx.fillText('vec3 color = mix(a, b, t);', 35, 45);
          nbCtx.fillText('// TODO: add noise', 35, 77);

          const notebookTexture = new THREE.CanvasTexture(notebookCanvas);
          const notebookGeom = new THREE.BoxGeometry(0.8, 0.025, 1.1, 4, 1, 4);
          const notebookMat = new THREE.MeshStandardMaterial({
            map: notebookTexture,
            roughness: 0.95
          });
          const notebook = new THREE.Mesh(notebookGeom, notebookMat);
          notebook.position.set(-1.2, -1.98, -0.8);
          notebook.rotation.y = -0.3;
          notebook.userData = { type: 'notebook', reactionIntensity: 0 };
          scene.add(notebook);
          interactiveObjects.push(notebook);
          shaderReactions.notebook = { intensity: 0, target: 0 };

          // Spiral binding with more detail
          const spirals = [];
          for (let i = 0; i < 12; i++) {
            const spiralGeom = new THREE.TorusGeometry(0.025, 0.006, 8, 16);
            const spiralMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.2 });
            const spiral = new THREE.Mesh(spiralGeom, spiralMat);
            spiral.position.set(-1.55, -1.965, -1.3 + i * 0.09);
            spiral.rotation.y = Math.PI / 2;
            scene.add(spiral);
            spirals.push(spiral);
          }

          // === ENHANCED PENCIL CUP with shader reaction ===
          const pencilCupGeom = new THREE.CylinderGeometry(0.16, 0.13, 0.45, 24, 4);
          // Create brushed metal texture
          const brushedCanvas = document.createElement('canvas');
          brushedCanvas.width = 64; brushedCanvas.height = 128;
          const bmCtx = brushedCanvas.getContext('2d');
          bmCtx.fillStyle = '#3a5a5a';
          bmCtx.fillRect(0, 0, 64, 128);
          bmCtx.strokeStyle = 'rgba(255,255,255,0.05)';
          for (let i = 0; i < 100; i++) {
            bmCtx.beginPath();
            bmCtx.moveTo(0, Math.random() * 128);
            bmCtx.lineTo(64, Math.random() * 128);
            bmCtx.stroke();
          }
          const brushedTexture = new THREE.CanvasTexture(brushedCanvas);

          const pencilCupMat = new THREE.MeshStandardMaterial({
            map: brushedTexture,
            metalness: 0.4,
            roughness: 0.6
          });
          const pencilCup = new THREE.Mesh(pencilCupGeom, pencilCupMat);
          pencilCup.position.set(2.2, -1.77, -1.5);
          pencilCup.userData = { type: 'pencilCup', reactionIntensity: 0 };
          scene.add(pencilCup);
          interactiveObjects.push(pencilCup);
          shaderReactions.pencilCup = { intensity: 0, target: 0 };

          // Enhanced pencils with proper tips
          const pencilMeshes = [];
          const pencilData = [
            { color: 0xFFD700, x: -0.04, tilt: -0.15 },
            { color: 0xFF6347, x: 0, tilt: 0.05 },
            { color: 0x4169E1, x: 0.04, tilt: 0.12 },
            { color: 0x32CD32, x: 0.02, tilt: -0.08 },
            { color: 0xFF69B4, x: -0.02, tilt: 0.18 }
          ];
          pencilData.forEach((p, i) => {
            // Pencil body (hexagonal would be ideal, using cylinder)
            const bodyGeom = new THREE.CylinderGeometry(0.018, 0.018, 0.55, 6);
            const bodyMat = new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.7 });
            const body = new THREE.Mesh(bodyGeom, bodyMat);
            body.position.set(2.2 + p.x, -1.49, -1.5 + (i - 2) * 0.02);
            body.rotation.z = p.tilt;
            body.rotation.x = (Math.random() - 0.5) * 0.1;
            scene.add(body);
            pencilMeshes.push(body);

            // Wood tip
            const tipGeom = new THREE.ConeGeometry(0.018, 0.06, 6);
            const tipMat = new THREE.MeshStandardMaterial({ color: 0xdeb887 });
            const tip = new THREE.Mesh(tipGeom, tipMat);
            tip.position.copy(body.position);
            tip.position.y += 0.305;
            tip.rotation.copy(body.rotation);
            scene.add(tip);

            // Graphite point
            const pointGeom = new THREE.ConeGeometry(0.005, 0.02, 6);
            const pointMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
            const point = new THREE.Mesh(pointGeom, pointMat);
            point.position.copy(tip.position);
            point.position.y += 0.04;
            point.rotation.copy(tip.rotation);
            scene.add(point);
          });

          // === ENHANCED GAME CARTRIDGES with holographic shader ===
          const cartridgeMeshes = [];
          const carts = [
            { x: -2.8, z: 0.8, rot: 0.4, color: 0x606060, label: 'POKEMON' },
            { x: -2.5, z: 1.1, rot: -0.2, color: 0x505050, label: 'ZELDA' },
            { x: -2.9, z: 1.4, rot: 0.9, color: 0x555555, label: 'METROID' },
          ];

          // Holographic label shader
          const holoVertShader = `
            varying vec2 vUv;
            varying vec3 vNormal;
            varying vec3 vViewPosition;
            void main() {
              vUv = uv;
              vNormal = normalMatrix * normal;
              vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
              vViewPosition = -mvPosition.xyz;
              gl_Position = projectionMatrix * mvPosition;
            }
          `;
          const holoFragShader = `
            uniform float uTime;
            uniform float uIntensity;
            uniform vec3 uBaseColor;
            varying vec2 vUv;
            varying vec3 vNormal;
            varying vec3 vViewPosition;

            void main() {
              vec3 viewDir = normalize(vViewPosition);
              float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), 3.0);

              // Rainbow shift based on angle and time
              float hue = vUv.x * 2.0 + vUv.y + uTime * 0.5 + fresnel * 2.0;
              vec3 rainbow = vec3(
                sin(hue) * 0.5 + 0.5,
                sin(hue + 2.094) * 0.5 + 0.5,
                sin(hue + 4.189) * 0.5 + 0.5
              );

              // Sparkle effect
              float sparkle = sin(vUv.x * 50.0 + uTime * 3.0) * sin(vUv.y * 50.0 - uTime * 2.0);
              sparkle = pow(max(0.0, sparkle), 8.0);

              vec3 holoColor = mix(uBaseColor, rainbow, uIntensity * (fresnel + 0.3));
              holoColor += sparkle * uIntensity * 0.5;

              gl_FragColor = vec4(holoColor, 1.0);
            }
          `;

          carts.forEach((c, idx) => {
            // Cartridge body with notch detail
            const cartGroup = new THREE.Group();
            const cartGeom = new THREE.BoxGeometry(0.48, 0.1, 0.6, 2, 1, 2);
            const cartMat = new THREE.MeshStandardMaterial({ color: c.color, roughness: 0.5, metalness: 0.1 });
            const cart = new THREE.Mesh(cartGeom, cartMat);
            cartGroup.add(cart);

            // Notch at top
            const notchGeom = new THREE.BoxGeometry(0.15, 0.08, 0.1);
            const notch = new THREE.Mesh(notchGeom, cartMat);
            notch.position.set(0, 0.04, -0.25);
            cartGroup.add(notch);

            // Holographic label with shader
            const labelGeom = new THREE.PlaneGeometry(0.35, 0.4);
            const labelMat = new THREE.ShaderMaterial({
              uniforms: {
                uTime: { value: 0 },
                uIntensity: { value: 0 },
                uBaseColor: { value: new THREE.Color(c.color).multiplyScalar(1.5) }
              },
              vertexShader: holoVertShader,
              fragmentShader: holoFragShader
            });
            const label = new THREE.Mesh(labelGeom, labelMat);
            label.position.set(0, 0.052, 0);
            label.rotation.x = -Math.PI / 2;
            cartGroup.add(label);

            cartGroup.position.set(c.x, -1.95, c.z);
            cartGroup.rotation.y = c.rot;
            cartGroup.userData = { type: 'cartridge', reactionIntensity: 0, labelMat: labelMat, index: idx };
            scene.add(cartGroup);
            cartridgeMeshes.push(cartGroup);
            interactiveObjects.push(cartGroup);
          });
          shaderReactions.cartridges = { intensity: 0, target: 0 };

          // === ENHANCED SODA CAN with fizz shader ===
          const sodaCanGeom = new THREE.CylinderGeometry(0.125, 0.12, 0.42, 32, 8);

          // Soda can label texture
          const sodaCanvas = document.createElement('canvas');
          sodaCanvas.width = 256; sodaCanvas.height = 128;
          const sodaCtx = sodaCanvas.getContext('2d');
          // Red gradient
          const sodaGrad = sodaCtx.createLinearGradient(0, 0, 256, 0);
          sodaGrad.addColorStop(0, '#aa0000');
          sodaGrad.addColorStop(0.5, '#dd2222');
          sodaGrad.addColorStop(1, '#aa0000');
          sodaCtx.fillStyle = sodaGrad;
          sodaCtx.fillRect(0, 0, 256, 128);
          // Brand text
          sodaCtx.fillStyle = '#ffffff';
          sodaCtx.font = 'bold 40px Arial';
          sodaCtx.textAlign = 'center';
          sodaCtx.fillText('COLA', 128, 70);
          // Decorative swirl
          sodaCtx.strokeStyle = 'rgba(255,255,255,0.3)';
          sodaCtx.lineWidth = 3;
          sodaCtx.beginPath();
          sodaCtx.moveTo(20, 100);
          sodaCtx.quadraticCurveTo(128, 60, 236, 100);
          sodaCtx.stroke();

          const sodaTexture = new THREE.CanvasTexture(sodaCanvas);
          const sodaCanMat = new THREE.MeshStandardMaterial({
            map: sodaTexture,
            metalness: 0.8,
            roughness: 0.25
          });
          const sodaCan = new THREE.Mesh(sodaCanGeom, sodaCanMat);
          sodaCan.position.set(2.8, -1.79, 0.8);
          sodaCan.userData = { type: 'sodaCan', reactionIntensity: 0 };
          scene.add(sodaCan);
          interactiveObjects.push(sodaCan);
          shaderReactions.sodaCan = { intensity: 0, target: 0 };

          // Can top with pull tab detail
          const canTopGeom = new THREE.CylinderGeometry(0.115, 0.12, 0.025, 32);
          const canTopMat = new THREE.MeshStandardMaterial({ color: 0xd0d0d0, metalness: 0.95, roughness: 0.15 });
          const sodaCanTop = new THREE.Mesh(canTopGeom, canTopMat);
          sodaCanTop.position.set(2.8, -1.57, 0.8);
          scene.add(sodaCanTop);

          // Pull tab
          const tabGeom = new THREE.TorusGeometry(0.03, 0.008, 6, 12, Math.PI);
          const tab = new THREE.Mesh(tabGeom, canTopMat);
          tab.position.set(2.8, -1.555, 0.78);
          tab.rotation.x = Math.PI / 2;
          tab.rotation.z = 0.3;
          scene.add(tab);

          // Fizz particles for soda (created on demand during reaction)
          const fizzParticles = [];

          // === ENHANCED COFFEE MUG with ripple shader ===
          const mugX = -1.7, mugZ = -1.6;

          // Mug body with more segments
          const mugGeom = new THREE.CylinderGeometry(0.24, 0.19, 0.5, 32, 4);

          // Create ceramic texture
          const ceramicCanvas = document.createElement('canvas');
          ceramicCanvas.width = 128; ceramicCanvas.height = 128;
          const cerCtx = ceramicCanvas.getContext('2d');
          cerCtx.fillStyle = '#f0f0f0';
          cerCtx.fillRect(0, 0, 128, 128);
          // Subtle speckles
          for (let i = 0; i < 50; i++) {
            cerCtx.fillStyle = `rgba(${180 + Math.random() * 40}, ${180 + Math.random() * 40}, ${180 + Math.random() * 40}, 0.3)`;
            cerCtx.beginPath();
            cerCtx.arc(Math.random() * 128, Math.random() * 128, Math.random() * 2, 0, Math.PI * 2);
            cerCtx.fill();
          }
          const ceramicTexture = new THREE.CanvasTexture(ceramicCanvas);

          const mugMat = new THREE.MeshStandardMaterial({
            map: ceramicTexture,
            color: 0xffffff,
            roughness: 0.25,
            metalness: 0.05
          });
          const mug = new THREE.Mesh(mugGeom, mugMat);
          mug.position.set(mugX, -1.74, mugZ);
          mug.userData = { type: 'mug', reactionIntensity: 0 };
          scene.add(mug);
          interactiveObjects.push(mug);
          shaderReactions.mug = { intensity: 0, target: 0 };

          // Mug rim (slightly thicker)
          const rimGeom = new THREE.TorusGeometry(0.24, 0.015, 8, 32);
          const rim = new THREE.Mesh(rimGeom, mugMat);
          rim.position.set(mugX, -1.49, mugZ);
          rim.rotation.x = Math.PI / 2;
          scene.add(rim);

          // Handle with better geometry
          const handleGeom = new THREE.TorusGeometry(0.13, 0.025, 12, 16, Math.PI);
          const handle = new THREE.Mesh(handleGeom, mugMat);
          handle.position.set(mugX + 0.24, -1.74, mugZ);
          handle.rotation.y = Math.PI / 2;
          handle.rotation.x = Math.PI / 2;
          scene.add(handle);
          // Coffee inside with enhanced ripple reaction shader
          const coffeeGeom = new THREE.CircleGeometry(0.21, 48);
          const coffeeVertShader = `
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `;
          const coffeeFragShader = `
            uniform float time;
            uniform float uRippleIntensity;
            varying vec2 vUv;

            ${glslNoise}

            void main() {
              vec2 uv = vUv - 0.5;
              float dist = length(uv);

              // Base coffee color
              vec3 coffeeColor = vec3(0.22, 0.13, 0.08);
              vec3 creamColor = vec3(0.38, 0.28, 0.20);
              vec3 darkCoffee = vec3(0.12, 0.07, 0.04);

              // Subtle swirl pattern
              float angle = atan(uv.y, uv.x);
              float swirl = sin(angle * 3.0 + dist * 8.0 - time * 0.3) * 0.5 + 0.5;

              // Base ripple
              float ripple = sin(dist * 20.0 - time * 0.8) * 0.02;

              // Touch-triggered expanding ripple rings
              float touchRipple = 0.0;
              if (uRippleIntensity > 0.01) {
                float ripplePhase = (1.0 - uRippleIntensity) * 3.0;
                for (int i = 0; i < 3; i++) {
                  float ring = smoothstep(0.02, 0.0, abs(dist - ripplePhase * 0.15 - float(i) * 0.08));
                  touchRipple += ring * uRippleIntensity * (1.0 - float(i) * 0.3);
                }
              }

              // Edge highlight (rim of cup reflection)
              float rimEffect = smoothstep(0.4, 0.5, dist);

              // Mix colors with touch disturbance
              float disturb = fbm(uv * 10.0 + time * 0.2) * uRippleIntensity * 0.3;
              vec3 col = mix(coffeeColor, creamColor, swirl * 0.15 + ripple + disturb);
              col = mix(col, darkCoffee, touchRipple * 0.5);
              col += vec3(0.1) * rimEffect;

              // Surface reflection spot (moves when disturbed)
              vec2 reflectOffset = vec2(-0.1 + sin(time * 2.0 + uRippleIntensity * 10.0) * uRippleIntensity * 0.1, 0.1);
              float highlight = smoothstep(0.15, 0.0, length(uv - reflectOffset));
              col += vec3(0.18) * highlight * (1.0 - uRippleIntensity * 0.5);

              // Ripple highlights
              col += vec3(0.15, 0.12, 0.08) * touchRipple;

              gl_FragColor = vec4(col, 1.0);
            }
          `;
          const coffeeMat = new THREE.ShaderMaterial({
            uniforms: {
              time: { value: 0 },
              uRippleIntensity: { value: 0 }
            },
            vertexShader: coffeeVertShader,
            fragmentShader: coffeeFragShader
          });
          const coffee = new THREE.Mesh(coffeeGeom, coffeeMat);
          coffee.position.set(mugX, -1.49, mugZ);
          coffee.rotation.x = -Math.PI / 2;
          scene.add(coffee);

          // Volumetric steam with realistic shader
          const steamParticles = [];
          const steamCount = 15;
          const steamVertShader = `
            varying vec2 vUv;
            varying float vHeight;
            uniform float uTime;

            void main() {
              vUv = uv;
              vHeight = position.y;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `;
          const steamFragShader = `
            uniform float uTime;
            uniform float uOpacity;
            uniform float uLife;
            varying vec2 vUv;

            // Simplex noise for organic movement
            float hash(vec2 p) {
              return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
            }

            float noise(vec2 p) {
              vec2 i = floor(p);
              vec2 f = fract(p);
              float a = hash(i);
              float b = hash(i + vec2(1.0, 0.0));
              float c = hash(i + vec2(0.0, 1.0));
              float d = hash(i + vec2(1.0, 1.0));
              vec2 u = f * f * (3.0 - 2.0 * f);
              return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
            }

            float fbm(vec2 p) {
              float value = 0.0;
              float amplitude = 0.5;
              for (int i = 0; i < 4; i++) {
                value += noise(p) * amplitude;
                p *= 2.0;
                amplitude *= 0.5;
              }
              return value;
            }

            void main() {
              vec2 uv = vUv - 0.5;
              float dist = length(uv);

              // Wispy turbulent shape
              float turbulence = fbm(uv * 4.0 + uTime * 0.5);
              float wisp = fbm(uv * 3.0 - vec2(0.0, uTime * 0.8));

              // Soft circular falloff with noise edge
              float edge = smoothstep(0.5, 0.1 + turbulence * 0.15, dist);

              // Vary density across the steam
              float density = edge * (0.6 + wisp * 0.4);

              // Warm white/gray color
              vec3 steamColor = mix(vec3(0.95, 0.95, 0.98), vec3(0.85, 0.88, 0.92), wisp);

              // Life-based fade (fades as particle rises)
              float lifeFade = smoothstep(1.0, 0.0, uLife);

              float alpha = density * uOpacity * lifeFade * 0.5;

              gl_FragColor = vec4(steamColor, alpha);
            }
          `;

          for (let i = 0; i < steamCount; i++) {
            const steamGeo = new THREE.PlaneGeometry(0.15, 0.25);
            const steamMat = new THREE.ShaderMaterial({
              uniforms: {
                uTime: { value: 0 },
                uOpacity: { value: 0.7 },
                uLife: { value: 0 }
              },
              vertexShader: steamVertShader,
              fragmentShader: steamFragShader,
              transparent: true,
              side: THREE.DoubleSide,
              depthWrite: false,
              blending: THREE.NormalBlending
            });
            const steam = new THREE.Mesh(steamGeo, steamMat);
            steam.position.set(
              mugX + (Math.random() - 0.5) * 0.12,
              -1.52 + Math.random() * 0.2,
              mugZ + (Math.random() - 0.5) * 0.12
            );
            steam.userData = {
              baseY: -1.52,
              speed: 0.0006 + Math.random() * 0.0004,
              drift: (Math.random() - 0.5) * 0.0002,
              phase: Math.random() * Math.PI * 2,
              timeOffset: Math.random() * 10
            };
            scene.add(steam);
            steamParticles.push(steam);
          }

          // Steam animation function
          function updateSteam(time) {
            steamParticles.forEach(s => {
              s.position.y += s.userData.speed;
              s.position.x += Math.sin(time * 0.3 + s.userData.phase) * 0.0002 + s.userData.drift;
              s.position.z += Math.cos(time * 0.25 + s.userData.phase) * 0.00015;

              // Calculate life (0 = just spawned, 1 = fully risen)
              const height = s.position.y - s.userData.baseY;
              const maxHeight = 0.6;
              const life = Math.min(height / maxHeight, 1.0);

              s.material.uniforms.uLife.value = life;
              s.material.uniforms.uTime.value = time + s.userData.timeOffset;

              // Scale up as it rises
              const scale = 1 + height * 3;
              s.scale.set(scale, scale * 1.2, 1);

              // Reset when fully faded
              if (height > maxHeight) {
                s.position.y = s.userData.baseY;
                s.position.x = mugX + (Math.random() - 0.5) * 0.12;
                s.position.z = mugZ + (Math.random() - 0.5) * 0.12;
                s.userData.timeOffset = Math.random() * 10;
              }

              // Billboard - face camera
              s.lookAt(camera.position);
            });
          }

          // === ENHANCED LINK CABLE with energy pulse shader ===
          const cableGroup = new THREE.Group();
          const cableMat = new THREE.MeshStandardMaterial({ color: 0x4a4a6a, roughness: 0.7, metalness: 0.2 });
          const cableMeshes = [];
          for (let i = 0; i < 15; i++) {
            const cableGeom = new THREE.TorusGeometry(0.1 + i * 0.005, 0.012, 12, 24);
            const cable = new THREE.Mesh(cableGeom, cableMat.clone());
            cable.position.set(0, i * 0.004, 0);
            cable.rotation.z = i * 0.1;
            cableGroup.add(cable);
            cableMeshes.push(cable);
          }
          cableGroup.position.set(-1.8, -1.97, 1.8);
          cableGroup.rotation.x = Math.PI / 2;
          cableGroup.userData = { type: 'cable', reactionIntensity: 0 };
          scene.add(cableGroup);
          interactiveObjects.push(cableGroup);
          shaderReactions.cable = { intensity: 0, target: 0 };

          // Cable connector with detail
          const connectorGroup = new THREE.Group();
          const connectorBody = new THREE.Mesh(
            new THREE.BoxGeometry(0.14, 0.07, 0.22, 2, 1, 2),
            cableMat
          );
          connectorGroup.add(connectorBody);
          // Connector pins
          for (let i = 0; i < 4; i++) {
            const pin = new THREE.Mesh(
              new THREE.CylinderGeometry(0.008, 0.008, 0.04, 6),
              new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9 })
            );
            pin.position.set(-0.03 + i * 0.02, -0.04, 0);
            pin.rotation.x = Math.PI / 2;
            connectorGroup.add(pin);
          }
          connectorGroup.position.set(-1.5, -1.96, 2.0);
          connectorGroup.rotation.y = 0.5;
          scene.add(connectorGroup);

          // === ENHANCED BATTERIES with energy glow shader ===
          const batteryGroup = new THREE.Group();
          const batteryMeshes = [];
          const battPositions = [[0.8, 2.2, 0], [1.0, 2.0, 0.3], [0.6, 2.4, -0.2], [1.2, 2.3, 0.15]];

          // Battery shader for energy glow
          const batteryVertShader = `
            varying vec2 vUv;
            varying vec3 vNormal;
            void main() {
              vUv = uv;
              vNormal = normalMatrix * normal;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `;
          const batteryFragShader = `
            uniform float uIntensity;
            uniform float uTime;
            varying vec2 vUv;
            varying vec3 vNormal;

            void main() {
              // Gold base color
              vec3 goldColor = vec3(0.85, 0.65, 0.13);
              vec3 brightGold = vec3(1.0, 0.9, 0.4);

              // Energy pulse traveling along battery
              float pulse = sin(vUv.y * 20.0 - uTime * 8.0) * 0.5 + 0.5;
              pulse = pow(pulse, 4.0) * uIntensity;

              // Edge glow
              float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
              float edgeGlow = fresnel * uIntensity;

              vec3 col = mix(goldColor, brightGold, pulse + edgeGlow);
              col += vec3(0.2, 0.5, 1.0) * pulse * 0.3; // Blue energy tint

              gl_FragColor = vec4(col, 1.0);
            }
          `;

          battPositions.forEach((pos, i) => {
            // Battery body
            const battGeom = new THREE.CylinderGeometry(0.045, 0.045, 0.22, 16, 8);
            const battMat = new THREE.ShaderMaterial({
              uniforms: {
                uIntensity: { value: 0 },
                uTime: { value: 0 }
              },
              vertexShader: batteryVertShader,
              fragmentShader: batteryFragShader
            });
            const batt = new THREE.Mesh(battGeom, battMat);
            batt.position.set(pos[0], -1.975, pos[1]);
            batt.rotation.z = Math.PI / 2;
            batt.rotation.y = pos[2];
            batt.userData = { type: 'battery', reactionIntensity: 0, index: i };
            scene.add(batt);
            batteryMeshes.push(batt);
            interactiveObjects.push(batt);

            // Positive terminal
            const termGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.02, 8);
            const termMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.9 });
            const term = new THREE.Mesh(termGeom, termMat);
            term.position.copy(batt.position);
            term.position.x += 0.12 * Math.cos(pos[2]);
            term.position.z -= 0.12 * Math.sin(pos[2]);
            term.rotation.z = Math.PI / 2;
            scene.add(term);
          });
          shaderReactions.batteries = { intensity: 0, target: 0 };

          // === ENHANCED DESK LAMP with warm glow pulse shader ===
          const lampGroup = new THREE.Group();

          // Weighted base with texture
          const lampBaseGeom = new THREE.CylinderGeometry(0.28, 0.32, 0.1, 24, 2);
          const lampBaseMat = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            metalness: 0.7,
            roughness: 0.3
          });
          const lampBase = new THREE.Mesh(lampBaseGeom, lampBaseMat);
          lampGroup.add(lampBase);

          // Articulated arm segments
          const armMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.6, roughness: 0.4 });
          const arm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 12), armMat);
          arm1.position.set(0, 0.3, 0);
          lampGroup.add(arm1);

          // Joint
          const joint = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), armMat);
          joint.position.set(0, 0.55, 0);
          lampGroup.add(joint);

          const arm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.55, 12), armMat);
          arm2.position.set(0, 0.85, -0.1);
          arm2.rotation.x = 0.2;
          lampGroup.add(arm2);

          // Lamp shade with interior
          const lampShadeGeom = new THREE.ConeGeometry(0.32, 0.4, 24, 1, true);
          const lampShadeMat = new THREE.MeshStandardMaterial({
            color: 0x2d4a2d,
            side: THREE.DoubleSide,
            metalness: 0.1,
            roughness: 0.7
          });
          const lampShade = new THREE.Mesh(lampShadeGeom, lampShadeMat);
          lampShade.position.set(0, 1.1, -0.15);
          lampShade.rotation.x = Math.PI + 0.15;
          lampGroup.add(lampShade);

          // Inner shade (lighter)
          const innerShadeGeom = new THREE.ConeGeometry(0.3, 0.38, 24, 1, true);
          const innerShadeMat = new THREE.MeshStandardMaterial({
            color: 0xffeedd,
            side: THREE.BackSide,
            emissive: 0xffcc88,
            emissiveIntensity: 0.2
          });
          const innerShade = new THREE.Mesh(innerShadeGeom, innerShadeMat);
          innerShade.position.copy(lampShade.position);
          innerShade.rotation.copy(lampShade.rotation);
          lampGroup.add(innerShade);

          lampGroup.position.set(2.8, -1.96, -2.2);
          lampGroup.userData = { type: 'lamp', reactionIntensity: 0, innerShade: innerShade };
          scene.add(lampGroup);
          interactiveObjects.push(lampGroup);
          shaderReactions.lamp = { intensity: 0, target: 0 };

          // === ENHANCED ERASER with soft bounce glow ===
          const eraserGeom = new THREE.BoxGeometry(0.22, 0.09, 0.45, 4, 2, 4);
          // Rubber texture
          const rubberCanvas = document.createElement('canvas');
          rubberCanvas.width = 64; rubberCanvas.height = 64;
          const rubCtx = rubberCanvas.getContext('2d');
          rubCtx.fillStyle = '#ffb6c1';
          rubCtx.fillRect(0, 0, 64, 64);
          // Wear marks
          rubCtx.fillStyle = 'rgba(255,255,255,0.2)';
          for (let i = 0; i < 10; i++) {
            rubCtx.fillRect(Math.random() * 64, Math.random() * 64, Math.random() * 15, 2);
          }
          // Brand imprint
          rubCtx.fillStyle = 'rgba(150,80,100,0.4)';
          rubCtx.font = 'bold 10px sans-serif';
          rubCtx.fillText('SOFT', 18, 35);
          const rubberTexture = new THREE.CanvasTexture(rubberCanvas);

          const eraserMat = new THREE.MeshStandardMaterial({
            map: rubberTexture,
            color: 0xffb6c1,
            roughness: 0.98
          });
          const eraser = new THREE.Mesh(eraserGeom, eraserMat);
          eraser.position.set(-0.8, -1.955, -0.3);
          eraser.rotation.y = 0.4;
          eraser.userData = { type: 'eraser', reactionIntensity: 0, baseY: -1.955 };
          scene.add(eraser);
          interactiveObjects.push(eraser);
          shaderReactions.eraser = { intensity: 0, target: 0 };

          // === ENHANCED CALCULATOR with LCD shader ===
          const calcGroup = new THREE.Group();

          const calcBodyGeom = new THREE.BoxGeometry(0.55, 0.06, 0.75, 2, 1, 2);
          const calcBodyMat = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            roughness: 0.5,
            metalness: 0.1
          });
          const calcBody = new THREE.Mesh(calcBodyGeom, calcBodyMat);
          calcGroup.add(calcBody);

          // LCD screen with shader
          const lcdVertShader = `
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `;
          const lcdFragShader = `
            uniform float uTime;
            uniform float uFlashIntensity;
            varying vec2 vUv;

            void main() {
              // LCD green base
              vec3 lcdOff = vec3(0.4, 0.5, 0.35);
              vec3 lcdOn = vec3(0.1, 0.15, 0.1);
              vec3 flashColor = vec3(0.7, 1.0, 0.6);

              // 7-segment display simulation
              float digit = 0.0;
              vec2 uv = vUv;

              // Pixelated segments
              vec2 segUv = fract(uv * vec2(8.0, 1.0));
              float seg = step(0.2, segUv.x) * step(segUv.x, 0.8);
              seg *= step(0.3, segUv.y) * step(segUv.y, 0.7);

              // Random digits effect during flash
              float randDigit = fract(sin(floor(uv.x * 8.0) * 127.1 + uTime * 5.0) * 43758.5) * uFlashIntensity;

              vec3 col = mix(lcdOff, lcdOn, seg * (0.3 + randDigit * 0.7));

              // Flash effect
              col = mix(col, flashColor, uFlashIntensity * 0.6);

              // Scanlines
              col *= 0.95 + 0.05 * sin(vUv.y * 100.0);

              gl_FragColor = vec4(col, 1.0);
            }
          `;

          const lcdMat = new THREE.ShaderMaterial({
            uniforms: {
              uTime: { value: 0 },
              uFlashIntensity: { value: 0 }
            },
            vertexShader: lcdVertShader,
            fragmentShader: lcdFragShader
          });

          const lcdGeom = new THREE.PlaneGeometry(0.4, 0.12);
          const lcd = new THREE.Mesh(lcdGeom, lcdMat);
          lcd.position.set(0, 0.032, -0.22);
          lcd.rotation.x = -Math.PI / 2;
          calcGroup.add(lcd);

          // Calculator buttons
          const btnMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8 });
          for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
              const btn = new THREE.Mesh(
                new THREE.BoxGeometry(0.08, 0.02, 0.08, 1, 1, 1),
                btnMat
              );
              btn.position.set(-0.15 + col * 0.1, 0.035, 0.05 + row * 0.1);
              calcGroup.add(btn);
            }
          }

          calcGroup.position.set(2.5, -1.94, -1.6);
          calcGroup.rotation.y = 0.3;
          calcGroup.userData = { type: 'calculator', reactionIntensity: 0, lcdMat: lcdMat };
          scene.add(calcGroup);
          interactiveObjects.push(calcGroup);
          shaderReactions.calculator = { intensity: 0, target: 0 };

          // === ENHANCED iPad with glitch shader ===
          const ipadGroup = new THREE.Group();

          // iPad body with chamfered edges (space gray)
          const ipadBodyGeom = new THREE.BoxGeometry(1.15, 0.045, 1.55, 4, 1, 4);
          const ipadBodyMat = new THREE.MeshStandardMaterial({
            color: 0x3a3a3c,
            metalness: 0.85,
            roughness: 0.25
          });
          const ipadBody = new THREE.Mesh(ipadBodyGeom, ipadBodyMat);
          ipadGroup.add(ipadBody);

          // Screen bezel
          const bezelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
          const bezel = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.45), bezelMat);
          bezel.position.y = 0.024;
          bezel.rotation.x = -Math.PI / 2;
          ipadGroup.add(bezel);

          // iPad screen with glitch shader
          const glitchVertShader = `
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `;
          const glitchFragShader = `
            uniform sampler2D uTexture;
            uniform float uTime;
            uniform float uGlitchIntensity;
            varying vec2 vUv;

            float rand(vec2 co) {
              return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
            }

            void main() {
              vec2 uv = vUv;

              // Horizontal glitch offset
              float glitchLine = step(0.99, rand(vec2(floor(uv.y * 50.0), floor(uTime * 10.0))));
              float offset = glitchLine * (rand(vec2(uTime, uv.y)) - 0.5) * 0.1 * uGlitchIntensity;
              uv.x += offset;

              // Chromatic aberration
              float aberration = uGlitchIntensity * 0.01;
              vec4 colR = texture2D(uTexture, uv + vec2(aberration, 0.0));
              vec4 colG = texture2D(uTexture, uv);
              vec4 colB = texture2D(uTexture, uv - vec2(aberration, 0.0));

              vec3 col = vec3(colR.r, colG.g, colB.b);

              // Scanline effect
              float scanline = sin(uv.y * 400.0 + uTime * 5.0) * 0.03 * uGlitchIntensity;
              col += scanline;

              // Random block corruption
              float blockGlitch = step(0.995, rand(vec2(floor(uv.x * 20.0), floor(uv.y * 20.0 + uTime))));
              col = mix(col, vec3(rand(uv + uTime), rand(uv * 2.0 + uTime), rand(uv * 3.0 + uTime)), blockGlitch * uGlitchIntensity);

              // Color inversion bands
              float invertBand = step(0.98, sin(uv.y * 30.0 + uTime * 20.0)) * uGlitchIntensity;
              col = mix(col, 1.0 - col, invertBand * 0.5);

              gl_FragColor = vec4(col, 1.0);
            }
          `;

          // Create iPad screen texture
          const ipadCanvas = document.createElement('canvas');
          ipadCanvas.width = 256; ipadCanvas.height = 340;
          const ipadCtx = ipadCanvas.getContext('2d');

          // Editor background
          ipadCtx.fillStyle = '#1e1e2e';
          ipadCtx.fillRect(0, 0, 256, 340);

          // Title bar
          ipadCtx.fillStyle = '#2d2d3d';
          ipadCtx.fillRect(0, 0, 256, 28);
          ipadCtx.fillStyle = '#888';
          ipadCtx.font = '12px monospace';
          ipadCtx.fillText('shader.frag', 10, 18);

          // Traffic lights
          ipadCtx.fillStyle = '#ff5f56';
          ipadCtx.beginPath(); ipadCtx.arc(220, 14, 6, 0, Math.PI*2); ipadCtx.fill();
          ipadCtx.fillStyle = '#ffbd2e';
          ipadCtx.beginPath(); ipadCtx.arc(200, 14, 6, 0, Math.PI*2); ipadCtx.fill();
          ipadCtx.fillStyle = '#27ca40';
          ipadCtx.beginPath(); ipadCtx.arc(180, 14, 6, 0, Math.PI*2); ipadCtx.fill();

          // Code with syntax highlighting
          const codeLines = [
            { text: 'uniform float u_time;', color: '#c678dd' },
            { text: 'uniform vec2 u_resolution;', color: '#c678dd' },
            { text: '', color: '#666' },
            { text: 'void main() {', color: '#61afef' },
            { text: '  vec2 uv = gl_FragCoord.xy', color: '#abb2bf' },
            { text: '    / u_resolution;', color: '#abb2bf' },
            { text: '', color: '#666' },
            { text: '  // Rainbow effect', color: '#5c6370' },
            { text: '  float hue = uv.x + u_time;', color: '#98c379' },
            { text: '  vec3 col = vec3(', color: '#98c379' },
            { text: '    sin(hue) * 0.5 + 0.5,', color: '#d19a66' },
            { text: '    sin(hue + 2.09) * 0.5,', color: '#d19a66' },
            { text: '    sin(hue + 4.18) * 0.5);', color: '#d19a66' },
            { text: '', color: '#666' },
            { text: '  gl_FragColor =', color: '#e5c07b' },
            { text: '    vec4(col, 1.0);', color: '#e5c07b' },
            { text: '}', color: '#61afef' },
          ];

          ipadCtx.font = '11px monospace';
          codeLines.forEach((line, i) => {
            ipadCtx.fillStyle = '#4a4a5a';
            ipadCtx.fillText((i + 1).toString().padStart(2), 6, 48 + i * 17);
            ipadCtx.fillStyle = line.color;
            ipadCtx.fillText(line.text, 28, 48 + i * 17);
          });

          // Cursor
          ipadCtx.fillStyle = '#528bff';
          ipadCtx.fillRect(180, 295, 9, 15);

          const ipadTexture = new THREE.CanvasTexture(ipadCanvas);

          const ipadScreenMat = new THREE.ShaderMaterial({
            uniforms: {
              uTexture: { value: ipadTexture },
              uTime: { value: 0 },
              uGlitchIntensity: { value: 0 }
            },
            vertexShader: glitchVertShader,
            fragmentShader: glitchFragShader
          });

          const ipadScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 1.35), ipadScreenMat);
          ipadScreen.position.y = 0.025;
          ipadScreen.rotation.x = -Math.PI / 2;
          ipadGroup.add(ipadScreen);

          // Camera bump
          const cameraBump = new THREE.Mesh(
            new THREE.BoxGeometry(0.15, 0.02, 0.15),
            ipadBodyMat
          );
          cameraBump.position.set(-0.4, 0.03, -0.6);
          ipadGroup.add(cameraBump);

          ipadGroup.position.set(1.6, -1.955, -1.2);
          ipadGroup.rotation.y = -0.15;
          ipadGroup.userData = { type: 'ipad', reactionIntensity: 0, screenMat: ipadScreenMat };
          scene.add(ipadGroup);
          interactiveObjects.push(ipadGroup);
          shaderReactions.ipad = { intensity: 0, target: 0 };

          // Apple Pencil with detail
          const applePencilGroup = new THREE.Group();
          const pencilBodyGeom = new THREE.CylinderGeometry(0.022, 0.02, 0.72, 12);
          const pencilBodyMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.25,
            metalness: 0.1
          });
          const applePencilBody = new THREE.Mesh(pencilBodyGeom, pencilBodyMat);
          applePencilGroup.add(applePencilBody);

          // Flat side for charging
          const flatSide = new THREE.Mesh(
            new THREE.BoxGeometry(0.01, 0.3, 0.035),
            pencilBodyMat
          );
          flatSide.position.set(-0.018, 0.15, 0);
          applePencilGroup.add(flatSide);

          // Tip
          const tipGeom = new THREE.ConeGeometry(0.02, 0.05, 12);
          const tipMat = new THREE.MeshStandardMaterial({ color: 0xd0d0d0, metalness: 0.8 });
          const tip = new THREE.Mesh(tipGeom, tipMat);
          tip.position.y = 0.385;
          applePencilGroup.add(tip);

          applePencilGroup.position.set(2.35, -1.97, -0.9);
          applePencilGroup.rotation.z = Math.PI / 2;
          applePencilGroup.rotation.y = -0.15;
          scene.add(applePencilGroup);

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

          // Gameboy plane from captured texture - PROPER SCALE relative to desk
          const texture = new THREE.CanvasTexture(canvas);
          texture.minFilter = THREE.LinearFilter;
          const aspect = canvas.width / canvas.height;

          // Scale gameboy to be realistic size on desk (about 1.5 units = ~15cm real size)
          const isMobile = window.innerWidth < 768;
          const isSmallMobile = window.innerWidth < 480;
          let gbScale = 1.8;  // Realistic desk scale

          // Adjust camera distance instead of gameboy size for mobile
          const gbGeom = new THREE.PlaneGeometry(gbScale * aspect, gbScale);
          const gbMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
          const gameboy = new THREE.Mesh(gbGeom, gbMat);
          scene.add(gameboy);

          // === IMPROVED LIGHTING ===
          // Brighter ambient for visibility
          const ambient = new THREE.AmbientLight(0x443333, 0.5);
          scene.add(ambient);

          // City light from window (blue ambient from outside)
          const cityLight = new THREE.PointLight(0x6688bb, 0.8, 15);
          cityLight.position.set(0, 1, -4);
          scene.add(cityLight);

          // Warm key light FROM the desk lamp position
          const lampLight = new THREE.PointLight(0xffcc66, 2.0, 10);
          lampLight.position.set(2.8, -0.6, -2.2);
          scene.add(lampLight);

          // Secondary lamp fill (bounced light)
          const lampFill = new THREE.PointLight(0xffaa44, 0.6, 6);
          lampFill.position.set(2.0, -1.5, -1.5);
          scene.add(lampFill);

          // Lamp glow cone (visible light emission)
          const lampGlowGeom = new THREE.ConeGeometry(0.5, 0.8, 16, 1, true);
          const lampGlowMat = new THREE.MeshBasicMaterial({
            color: 0xffdd88,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide
          });
          const lampGlow = new THREE.Mesh(lampGlowGeom, lampGlowMat);
          lampGlow.position.set(2.8, -1.3, -2.2);
          scene.add(lampGlow);

          // Light bulb inside lamp (glowing sphere)
          const bulbGeom = new THREE.SphereGeometry(0.1, 16, 16);
          const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffffdd });
          const bulb = new THREE.Mesh(bulbGeom, bulbMat);
          bulb.position.set(2.8, -0.75, -2.2);
          scene.add(bulb);

          // Cool fill light from left
          const fillLight = new THREE.PointLight(0x5577aa, 0.5, 15);
          fillLight.position.set(-4, 2, 1);
          scene.add(fillLight);

          // Soft overhead ambient
          const topLight = new THREE.DirectionalLight(0xffeedd, 0.3);
          topLight.position.set(0, 10, 0);
          scene.add(topLight);

          // Camera animation - two phases
          // Phase 1: Drop gameboy, zoom in close
          // Phase 2: Pan out to wide shot
          const phase1Duration = 2000;  // Drop and zoom in
          const phase2Duration = 3000;  // Pan out to wide shot
          const totalDuration = phase1Duration + phase2Duration;

          // Close-up camera target (during/after drop)
          const closeDistance = isSmallMobile ? 2.2 : isMobile ? 2.5 : 2.8;
          const closeHeight = isSmallMobile ? 1.5 : isMobile ? 1.8 : 2.0;

          // Wide shot camera target (final position like screenshot)
          const wideDistance = isSmallMobile ? 5.5 : isMobile ? 6.0 : 6.5;
          const wideHeight = isSmallMobile ? 3.5 : isMobile ? 4.0 : 4.5;

          let camDistance = 5;
          let camHeight = 0;
          let animationDone = false;

          camera.position.set(0, 0.5, camDistance);
          camera.lookAt(0, -0.5, 0);

          // Light fog for depth (not too dark)
          scene.fog = new THREE.Fog(0x1a1520, 10, 20);

          const startTime = Date.now();
          let crtFrame = 0;

          function animate() {
            const elapsed = Date.now() - startTime;

            // Phase 1: Drop gameboy and zoom in close
            if (elapsed < phase1Duration) {
              const progress = elapsed / phase1Duration;
              const eased = 1 - Math.pow(1 - progress, 3);

              // Rotate gameboy to lay flat
              gameboy.rotation.x = -Math.PI / 2 * eased * 0.95;
              gameboy.rotation.z = eased * 0.08;
              gameboy.position.y = -2 + 0.08 + (1 - eased) * 2.5;
              gameboy.position.z = eased * 0.3;
              gameboy.position.x = eased * -0.15;

              // Zoom in close to gameboy
              camHeight += (closeHeight * eased - camHeight) * 0.1;
              camDistance += (closeDistance - camDistance) * 0.08;
            }
            // Phase 2: Pan out to wide establishing shot
            else {
              const phase2Elapsed = elapsed - phase1Duration;
              const progress = Math.min(phase2Elapsed / phase2Duration, 1);
              // Smooth ease out
              const eased = 1 - Math.pow(1 - progress, 2.5);

              // Gameboy stays in place
              gameboy.rotation.x = -Math.PI / 2 * 0.95;
              gameboy.rotation.z = 0.08;
              gameboy.position.y = -2 + 0.08;
              gameboy.position.z = 0.3;
              gameboy.position.x = -0.15;

              // Pan out to wide shot
              const targetDist = closeDistance + (wideDistance - closeDistance) * eased;
              const targetH = closeHeight + (wideHeight - closeHeight) * eased;

              camDistance += (targetDist - camDistance) * 0.08;
              camHeight += (targetH - camHeight) * 0.08;

              if (progress >= 1) animationDone = true;
            }

            // Camera position with subtle drift
            camera.position.y = camHeight;
            camera.position.z = camDistance;
            camera.position.x = Math.sin(elapsed * 0.0001) * 0.15;
            camera.lookAt(0, -1.0, -0.5);

            // Update CRT static (every 3 frames for choppy retro feel)
            crtFrame++;
            if (crtFrame % 3 === 0) updateCRTStatic();

            // Animate steam
            updateSteam(elapsed * 0.001);

            // Animate coffee ripples
            coffeeMat.uniforms.time.value = elapsed * 0.001;

            // Animate runes if books are glowing
            if (booksGlowing) {
              drawRunes(elapsed * 0.001);
              runeTexture.needsUpdate = true;
              runePlaneMat.opacity = 0.6 + Math.sin(elapsed * 0.003) * 0.2;

              // Pulse the rune light
              if (runeLight) {
                runeLight.intensity = 1.5 + Math.sin(elapsed * 0.004) * 0.5;
              }
            }

            // === LERP ALL SHADER REACTIONS ===
            const lerpSpeed = 0.03;
            const time = elapsed * 0.001;

            // Coffee mug ripple
            shaderReactions.mug.intensity = lerp(shaderReactions.mug.intensity, shaderReactions.mug.target, lerpSpeed);
            shaderReactions.mug.target *= 0.98;
            coffeeMat.uniforms.uRippleIntensity.value = shaderReactions.mug.intensity;

            // Cartridge holographic effect
            shaderReactions.cartridges.intensity = lerp(shaderReactions.cartridges.intensity, shaderReactions.cartridges.target, lerpSpeed);
            shaderReactions.cartridges.target *= 0.97;
            cartridgeMeshes.forEach(cart => {
              if (cart.userData.labelMat) {
                cart.userData.labelMat.uniforms.uIntensity.value = shaderReactions.cartridges.intensity;
                cart.userData.labelMat.uniforms.uTime.value = time;
              }
            });

            // Battery energy pulse
            shaderReactions.batteries.intensity = lerp(shaderReactions.batteries.intensity, shaderReactions.batteries.target, lerpSpeed);
            shaderReactions.batteries.target *= 0.96;
            batteryMeshes.forEach(batt => {
              if (batt.material.uniforms) {
                batt.material.uniforms.uIntensity.value = shaderReactions.batteries.intensity;
                batt.material.uniforms.uTime.value = time;
              }
            });

            // Calculator LCD flash
            shaderReactions.calculator.intensity = lerp(shaderReactions.calculator.intensity, shaderReactions.calculator.target, lerpSpeed * 1.5);
            shaderReactions.calculator.target *= 0.94;
            if (calcGroup.userData.lcdMat) {
              calcGroup.userData.lcdMat.uniforms.uFlashIntensity.value = shaderReactions.calculator.intensity;
              calcGroup.userData.lcdMat.uniforms.uTime.value = time;
            }

            // iPad glitch effect
            shaderReactions.ipad.intensity = lerp(shaderReactions.ipad.intensity, shaderReactions.ipad.target, lerpSpeed);
            shaderReactions.ipad.target *= 0.95;
            if (ipadGroup.userData.screenMat) {
              ipadGroup.userData.screenMat.uniforms.uGlitchIntensity.value = shaderReactions.ipad.intensity;
              ipadGroup.userData.screenMat.uniforms.uTime.value = time;
            }

            // Lamp glow pulse
            shaderReactions.lamp.intensity = lerp(shaderReactions.lamp.intensity, shaderReactions.lamp.target, lerpSpeed);
            shaderReactions.lamp.target *= 0.97;
            if (lampGroup.userData.innerShade) {
              lampGroup.userData.innerShade.material.emissiveIntensity = 0.2 + shaderReactions.lamp.intensity * 0.8;
              lampLight.intensity = 2.0 + shaderReactions.lamp.intensity * 3.0;
            }

            // Eraser soft bounce
            shaderReactions.eraser.intensity = lerp(shaderReactions.eraser.intensity, shaderReactions.eraser.target, lerpSpeed * 2);
            shaderReactions.eraser.target *= 0.92;
            if (eraser.userData.baseY !== undefined) {
              eraser.position.y = eraser.userData.baseY + Math.sin(time * 15) * shaderReactions.eraser.intensity * 0.02;
              eraser.material.emissive = new THREE.Color(0xff88aa);
              eraser.material.emissiveIntensity = shaderReactions.eraser.intensity * 0.3;
            }

            // Soda can fizz (could add particle system here)
            shaderReactions.sodaCan.intensity = lerp(shaderReactions.sodaCan.intensity, shaderReactions.sodaCan.target, lerpSpeed);
            shaderReactions.sodaCan.target *= 0.96;
            if (shaderReactions.sodaCan.intensity > 0.1) {
              sodaCan.rotation.y += shaderReactions.sodaCan.intensity * 0.02;
            }

            // Pencil cup sparkle
            shaderReactions.pencilCup.intensity = lerp(shaderReactions.pencilCup.intensity, shaderReactions.pencilCup.target, lerpSpeed);
            shaderReactions.pencilCup.target *= 0.95;
            pencilMeshes.forEach((p, i) => {
              p.rotation.z += Math.sin(time * 5 + i) * shaderReactions.pencilCup.intensity * 0.01;
            });

            // Cable energy flow
            shaderReactions.cable.intensity = lerp(shaderReactions.cable.intensity, shaderReactions.cable.target, lerpSpeed);
            shaderReactions.cable.target *= 0.96;
            cableMeshes.forEach((cable, i) => {
              const pulse = Math.sin(time * 8 - i * 0.3) * 0.5 + 0.5;
              cable.material.emissive = new THREE.Color(0x4488ff);
              cable.material.emissiveIntensity = pulse * shaderReactions.cable.intensity * 0.5;
            });

            // Notebook shimmer
            shaderReactions.notebook.intensity = lerp(shaderReactions.notebook.intensity, shaderReactions.notebook.target, lerpSpeed);
            shaderReactions.notebook.target *= 0.95;
            notebook.material.emissive = new THREE.Color(0xffffdd);
            notebook.material.emissiveIntensity = shaderReactions.notebook.intensity * 0.2;

            renderer.render(scene, camera);
            requestAnimationFrame(animate);
          }
          animate();

          // Raycaster for all interactive object detection
          const raycaster = new THREE.Raycaster();
          const mouse = new THREE.Vector2();

          function onSceneClick(event) {
            // Calculate mouse position in normalized device coordinates
            const rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(mouse, camera);

            // Check all interactive objects (including nested meshes in groups)
            const allMeshes = [];
            interactiveObjects.forEach(obj => {
              if (obj.isGroup) {
                obj.traverse(child => {
                  if (child.isMesh) allMeshes.push(child);
                });
              } else {
                allMeshes.push(obj);
              }
            });

            const intersects = raycaster.intersectObjects(allMeshes, true);

            if (intersects.length > 0) {
              // Find the parent interactive object
              let hitObject = intersects[0].object;
              while (hitObject.parent && !hitObject.userData.type) {
                hitObject = hitObject.parent;
              }

              const objType = hitObject.userData.type;

              // Trigger unique shader reaction based on object type
              switch (objType) {
                case 'book':
                  // Toggle rune glow (existing behavior)
                  booksGlowing = !booksGlowing;
                  if (booksGlowing) {
                    runeLight = new THREE.PointLight(0x66aaff, 2, 3);
                    runeLight.position.set(-2.5, -1.2, -1.2);
                    scene.add(runeLight);
                    bookMeshes.forEach(book => {
                      book.material.forEach(mat => {
                        if (mat.emissive) {
                          mat.emissive.setHex(0x223344);
                          mat.emissiveIntensity = 0.3;
                        }
                      });
                    });
                  } else {
                    if (runeLight) { scene.remove(runeLight); runeLight = null; }
                    runePlaneMat.opacity = 0;
                    bookMeshes.forEach(book => {
                      book.material.forEach(mat => {
                        if (mat.emissive) {
                          mat.emissive.setHex(0x000000);
                          mat.emissiveIntensity = 0;
                        }
                      });
                    });
                  }
                  shaderReactions.books.target = 1.0;
                  break;

                case 'mug':
                  // Coffee ripple effect
                  shaderReactions.mug.target = 1.0;
                  break;

                case 'cartridge':
                  // Holographic shimmer
                  shaderReactions.cartridges.target = 1.0;
                  break;

                case 'battery':
                  // Energy pulse
                  shaderReactions.batteries.target = 1.0;
                  break;

                case 'calculator':
                  // LCD flash/scramble
                  shaderReactions.calculator.target = 1.0;
                  break;

                case 'ipad':
                  // Glitch effect
                  shaderReactions.ipad.target = 1.0;
                  break;

                case 'lamp':
                  // Warm glow pulse
                  shaderReactions.lamp.target = 1.0;
                  break;

                case 'eraser':
                  // Soft bounce glow
                  shaderReactions.eraser.target = 1.0;
                  break;

                case 'sodaCan':
                  // Fizz effect
                  shaderReactions.sodaCan.target = 1.0;
                  break;

                case 'pencilCup':
                  // Pencil scatter/sparkle
                  shaderReactions.pencilCup.target = 1.0;
                  break;

                case 'cable':
                  // Energy flow pulse
                  shaderReactions.cable.target = 1.0;
                  break;

                case 'notebook':
                  // Page shimmer
                  shaderReactions.notebook.target = 1.0;
                  break;
              }
            }
          }

          renderer.domElement.addEventListener('click', onSceneClick);
          renderer.domElement.addEventListener('touchend', (e) => {
            if (e.changedTouches.length > 0) {
              const touch = e.changedTouches[0];
              onSceneClick({ clientX: touch.clientX, clientY: touch.clientY });
            }
          });

          // Add vignette overlay for cinematic look
          const vignette = document.createElement('div');
          vignette.className = 'ending-vignette';
          document.body.appendChild(vignette);

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
          queueDialogue(() => showMessage('What will<br>SWEETBUN do?'), 1500);
        }
        else if (action === 'pokemon') {
          showMessage('SWEETBUN is<br>already out!');
          queueDialogue(() => showMessage('What will<br>SWEETBUN do?'), 1500);
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
        queueDialogue(() => showMessage('What will<br>SWEETBUN do?'), 1500);
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

    // Queue for pending dialogue callbacks (allows A to skip)
    let pendingDialogueCallback = null;
    let pendingDialogueTimeout = null;

    function queueDialogue(callback, delay) {
      // Clear any existing pending dialogue
      if (pendingDialogueTimeout) {
        clearTimeout(pendingDialogueTimeout);
      }
      pendingDialogueCallback = callback;
      pendingDialogueTimeout = setTimeout(() => {
        if (pendingDialogueCallback) {
          pendingDialogueCallback();
          pendingDialogueCallback = null;
          pendingDialogueTimeout = null;
        }
      }, delay);
    }

    function advanceDialogue() {
      // If there's a pending dialogue, execute it immediately
      if (pendingDialogueCallback) {
        clearTimeout(pendingDialogueTimeout);
        const callback = pendingDialogueCallback;
        pendingDialogueCallback = null;
        pendingDialogueTimeout = null;
        callback();
        return true;
      }
      return false;
    }

    function pressA() {
      // First try to advance any pending dialogue
      if (advanceDialogue()) return;

      if (isAnimating) return;
      const items = getMenuItems();
      const pos = cursorPos[currentMenu] || 0;
      if (items[pos]) {
        items[pos].click();
      }
    }

    // Also allow clicking/tapping the message box to advance
    battleMessage.addEventListener('click', advanceDialogue);
    battleMessage.style.cursor = 'pointer';

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
