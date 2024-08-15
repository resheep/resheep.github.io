var posts=["2020/04/01/hello-world/","2024/08/01/高中生物总结/"];function toRandomPost(){
    pjax.loadUrl('/'+posts[Math.floor(Math.random() * posts.length)]);
  };