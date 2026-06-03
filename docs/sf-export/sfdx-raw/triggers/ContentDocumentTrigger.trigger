trigger ContentDocumentTrigger on ContentDocument (before insert,after insert, before update, after update) {
    new ContentDocumentTriggerHandler().run();
}