---
title: 'Jank Busters Part One'
author: 'the jank busters: Jochen Eisinger, Michael Lippautz, and Hannes Payer'
avatars:
  - 'michael-lippautz'
  - 'hannes-payer'
date: 2015-10-30 13:33:37
tags:
  - memory
description: 'This article discusses optimizations that were implemented between Chrome 41 and Chrome 46 which significantly reduce garbage collection pauses, resulting in better user experience.'
---

Jank, 즉 시각적 버벅거림은 Chrome이 16.66ms 이내의 프레임을 렌더링하지 못한 경우 알아차릴 수 있습니다( 60프레임의 초 단위 동작을 중단할때). 현재 V8 가비지 컬렉션 작업의 대부분은 메인 렌더링 스레드에서 실행되고 있습니다. c.f Figure 1처럼 많은 objects를 관리해야 하는 경우에 종종 Jank가 발생할때가 있습니다. V8 팀에게 Jank 제거는 항상 최우선 사항이었습니다([1](https://blog.chromium.org/2011/11/game-changer-for-interactive.html), [2](https://www.youtube.com/watch?v=3vPOlGRH6zk), [3](https:/v8.dev/module/free-queue-collection)). 이 문서에서 크게 가비지 컬렉션의 일시적인 중지시간을 대폭 줄이고 사용자 경험을 향상시키는 크롬 41과 크롬 46 사이에 구현된 몇 가지 최적화에 대해 설명하고 있습니다. 


![Figure 1: 메인 스레드에서 실행된 가비지 컬렉션](https://v8.dev/_img/jank-busters/gc-main-thread.png)



가비지 컬렉션 중 주요 jank의 원천은 다양한 bookkeeping 자료 구조를 처리할때 생깁니다. 이러한 많은 자료 구조는 가비지 컬렉션과 무관한 최적화를 가능하게 합니다. 두 가지 예는 모든 Array Buffer의 list와 각 Array Buffer의 list of view입니다. 이러한 list를 사용하면 ArrayBuffer 뷰에 접근할때 강요되는 성능을 손상시키지 않고 DetachArrayBuffer 조작을 효율적으로 구현할 수 있습니다. 그러나 웹 페이지가 수백만 개의 Array Buffer를 만드는 상황에서(예를 들면 WebGL 기반 게임) 가비지 컬렉션이 생기는 중에 이러한 리스트들을 업데이트하면 큰 jank가 발생합니다. Chrome 46에서는 이러한 리스트들을 삭제하는 대신 Array Buffers에 저장되거나 모든 로드 전에 체크들을 삽입하여 분리된 버퍼들을 검출했습니다. 이를 프로그램 실행 중 곳곳에 퍼트려 GC동안 큰 bookkeeping 리스트들을 배회할때 발생하는 비용이 분할 상환됨으로써 결과적으로 jank가 적어집니다. 비록 액세스 단위 체크들은 이론적으로 Array Buffers를 아주 많이 사용하는 프로그램의 처리량을 늦출 수 있지만, 실제로 V8 최적화 컴파일러는 중복된 체크들을 삭제하고 루프에 배제된 체크들을 호이스트 시키는 경우가 많아 훨씬 원활한 실행 프로파일과 전체적인 성능 패널티가 거의 혹은 전혀 없는 결과를 낳습니다.

또 다른 jank의 원천은 Chrome과 V8 사이 공유되었던 objects의 수명을 추적하는 것과 관련된 bookkeeping이 원천입니다. 비록 Chrome과 V8의 메모리 heap는 서로 별개여도, Chrome의 C++ 코드로 구현되어 있지만 자바스크립트에서 접근할 수 있는 DOM 노드와 같은 특정 objects에 대해서는 동기화가 꼭 되야합니다. V8은 Chrome이 구현 세부 사항을 알지 못하면서 V8 objects를 조작할 수 있게 해주는 불투명한 데이터 유형인 handle을 만듭니다. Objects의 수명은 handle에 구속됩니다: 크롬이 handle을 유지하고 있는 한 V8의 garbage collector는 object를 버리지 않습니다. V8은 V8 API를 통해 Chrome으로 되돌아오는 handle마다 global reference라고 불리는 내부 자료 구조를 만듭니다, 그리고 
이러한 global reference들은 V8의 garbage collector한테 object가 아직 살아 있다고 말합니다. WebGL 게임의 경우 Chrome은 수백만 개의 handle들을 만들고 V8은 결국 handle들의 생애주기 관리를 위해 이에 대응되는 global reference들을 만들어야 합니다. 메인 garbage collection으로 일시 정지 하에 이러한 대량의 global reference들을 프로세싱하는건 jank로 관찰할 수 있습니다. 다행히 WebGL로 통신되는 object들은 단순히 전달될 뿐 실제로 변경되지는 않아, 단순한 정적 [escape analysis](https://en.wikipedia.org/wiki/Escape_analysis) 가 가능하게 됩니다. 본질적으로 WebGL 함수의 경우 보통 작은 배열을 파라미터로 사용하는 것으로 알려져 있으며 기본이 되는 데이터는 스택에 복사되어 global reference를 쓸모없게 만듭니다. 이런 혼합 접근 방식의 결과 rendering-heavy한 WebGL 게임에 대해서는 일시 정지 시간이 최대 50% 단축됩니다. V8의 garbage collection의 대부분은 메인 렌더링 스레드에서 실행됩니다. 가비지 컬렉션 운영을 동시 스레드로 이동하면 garbage collector 대기 시간이 단축되어 jank가 더욱 감소합니다. 메인 자바스크립트 애플리케이션과 garbage collector가 동일한 object들을 동시에 관찰하고 변경할 수 있기 때문에 이는 본래 복잡한 작업입니다. 지금까지, 동시성은 일반적인 object JS heap의 old generation을 sweeping하는 것으로 한정되어 있었습니다. 지금까지, 동시성은 보통 JS heap object의 old generation을 sweeping하는 것으로 한정되어 있었습니다. 최근에, 우리는 V8 heap의 map space와 코드에 대해 동시 sweeping 또한 구현했습니다. 추가로, 우리는 메인 스레드에서 수행하는 작업을 줄이기 위해 미사용 페이지의 동시 unmapping을 구현했습니다. c.f. 그림 2

![그림 2: 몇 가지 가비지 컬렉션 작업은 동시적인 garbage collection 스레드에서 실행됩니다.](https://v8.dev/_img/jank-busters/gc-concurrent-threads.png)


The impact of the discussed optimizations is clearly visible in WebGL-based games, for example [Turbolenz’s Oort Online demo](http://oortonline.gl/). The following video compares Chrome 41 to Chrome 46:

논의된 최적화의 영향은 WebGL 기반 게임에서 뚜렷하게 볼 수 있습니다. 예로 들면 [Turbolenz’s Oort Online demo](http://oortonline.gl/) . 아래 비디오는 Chrome 41과 Chrome 46을 비교하고 있습니다:

<figure>
  <div class="video video-16:9">
    <iframe src="https://www.youtube.com/embed/PgrCJpbTs9I" width="640" height="360" loading="lazy"></iframe>
  </div>
</figure>

현재 가비지 컬렉션 컴포넌트를 incremental, concurrent, parallel로 만들어 메인 스레드에서의 garbage collection으로 인한 일시 정지 시간을 더욱 단축시키려고 합니다. 프로덕션 상태 내 흥미로운 패치가 몇 개 준비되어 있으니 계속 지켜봐 주시기 바랍니다
