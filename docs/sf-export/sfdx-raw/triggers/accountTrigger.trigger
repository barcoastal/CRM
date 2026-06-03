trigger accountTrigger on Account (before insert, after insert, before update, after update) {
    if (!AccountHandler.byPassAccountTrigger) {
        new AccountHandler().run();
    }
}