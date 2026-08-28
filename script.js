document.addEventListener("DOMContentLoaded", function() {
    const bees = document.querySelectorAll('.bee-layer');

    // Функція для польоту бджоли до випадкової точки
    function flyBee(beeElement) {
        // Випадкова позиція (відносні координати)
        const targetX = Math.random() * 80 + 10 + '%'; // 10% - 90%
        const targetY = Math.random() * 60 + 30 + '%'; // 30% - 90%

        // Випадкова тривалість польоту
        const duration = Math.random() * 8 + 6; // 6-14 секунд

        // Віддзеркалення (повернути бджолу в напрямку польоту)
        const currentLeft = parseFloat(beeElement.style.left) || 10;
        const targetLeft = parseFloat(targetX);
        
        if (targetLeft > currentLeft) {
            beeElement.querySelector('img').style.transform = 'scaleX(1)'; // Летіти вправо
        } else {
            beeElement.querySelector('img').style.transform = 'scaleX(-1)'; // Летіти вліво
        }

        // Анімація руху (CSS перетворення)
        beeElement.style.transition = `left ${duration}s ease-in-out, top ${duration}s ease-in-out`;
        beeElement.style.left = targetX;
        beeElement.style.top = targetY;

        // Повторити через випадковий час після прильоту
        setTimeout(() => flyBee(beeElement), duration * 1000 + Math.random() * 5000);
    }

    // Запустити анімацію для кожної бджоли з невеликою затримкою
    bees.forEach((bee, index) => {
        setTimeout(() => flyBee(bee), index * 1000);
    });

    // Опціонально: Інтеракція при натисканні на вулик
    const beehive = document.querySelector('.beehive-sprite');
    beehive.addEventListener('click', function() {
        // Додати вібрацію
        beehive.style.animation = 'beehiveShake 0.5s ease-in-out';
        setTimeout(() => beehive.style.animation = '', 500);

        // Зробити виліт нової бджоли
        const newBeeContainer = document.createElement('div');
        newBeeContainer.className = 'bee-layer new-bee';
        newBeeContainer.style.left = beehive.offsetLeft + beehive.offsetWidth/2 + 'px';
        newBeeContainer.style.top = beehive.offsetTop + 'px';
        newBeeContainer.innerHTML = `<img src="https://em-content.zobj.net/source/noto-emoji-animations/344/honeybee_1f41d.gif" alt="Бджола" class="bee">`;
        document.getElementById('app-container').appendChild(newBeeContainer);
        flyBee(newBeeContainer);
    });

});
