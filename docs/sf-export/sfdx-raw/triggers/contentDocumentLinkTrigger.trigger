trigger contentDocumentLinkTrigger on ContentDocumentLink (after insert,before update, before insert, before delete) {

    if (TriggerDisablementCheckSvc.isTriggerDisabled(ContentDocumentLink.getSObjectType().getDescribe().getName())) {
        return; // Exit trigger if disabled via TriggerDisablementCheckSvc
    }

    new ContentDocumentLinkHandler().run();
}