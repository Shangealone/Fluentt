from app.modules.curriculum.schemas import Page
from app.modules.identity.errors import IdentityError
from app.modules.identity.session_service import authenticated_session
from app.modules.administration.service import resolve_session

READ_PERMISSION = "curriculum.read"


def browse(repo, raw, settings, query, kind, *, parent_id=None, node_id=None, admin_repo=None):
    if admin_repo is None and query.status is not None:
        raise IdentityError(422, "invalid_curriculum_filter", "Lifecycle filters require administrator access.")
    if admin_repo is not None and query.class_id is not None:
        raise IdentityError(422, "invalid_curriculum_filter", "Class context requires a mobile owner or membership.")
    if query.status is not None and kind not in {"versions", "topics", "lessons"}:
        raise IdentityError(422, "invalid_curriculum_filter", "This node has no independent lifecycle status.")

    def operation(user):
        context = repo.class_context(user, query.class_id) if query.class_id else None
        repo.structure_read_lock()
        if node_id is not None:
            return repo.detail(kind, node_id, query, context, admin_repo is not None)
        items, has_more = repo.rows(kind, parent_id, query, context, admin_repo is not None)
        return Page(items=items, limit=query.limit, offset=query.offset, has_more=has_more, class_context=context)

    if admin_repo is not None:
        return resolve_session(admin_repo, raw, required_permission=READ_PERMISSION, read_operation=operation)
    with authenticated_session(repo, raw, settings) as (_, user):
        result = operation(user)
    return result
