"""Thin wrappers around push module for routers."""
import push as push_module


async def send_push_for_message(*args, **kwargs):
    return await push_module.send_push_for_message(*args, **kwargs)


async def send_push_for_sealed_message(*args, **kwargs):
    return await push_module.send_push_for_sealed_message(*args, **kwargs)


async def send_push_for_call(*args, **kwargs):
    return await push_module.send_push_for_call(*args, **kwargs)


async def send_push_for_call_end(*args, **kwargs):
    return await push_module.send_push_for_call_end(*args, **kwargs)


async def send_push_for_friend_request(*args, **kwargs):
    return await push_module.send_push_for_friend_request(*args, **kwargs)


async def send_push_for_friend_accept(*args, **kwargs):
    return await push_module.send_push_for_friend_accept(*args, **kwargs)


async def send_push_for_status(*args, **kwargs):
    return await push_module.send_push_for_status(*args, **kwargs)


async def send_push_for_group_added(*args, **kwargs):
    return await push_module.send_push_for_group_added(*args, **kwargs)