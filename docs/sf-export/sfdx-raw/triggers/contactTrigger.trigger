trigger contactTrigger on Contact (before insert, before update, after insert, after update) {
    new ContactHandler().run();
}